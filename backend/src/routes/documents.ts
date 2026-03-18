import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { getNextDocumentNumber } from '../utils/numbering';
import { calculateLineTotal, calculateDocumentTotals, getVatRate } from '../utils/tax.utils';
import { generatePdf } from '../services/pdf';
import { createCashbookEntry } from '../services/cashbook';
import { sendDocumentEmail } from '../services/email';
import { sendWhatsApp } from '../services/whatsapp';
import {
  isAllocationRequired,
  hasAllocationCredentials,
  requestAllocationNumber,
  markAllocationFailed,
  getAllocationThreshold,
  testAllocationConnection,
} from '../services/allocation';
import { DocumentType } from '@prisma/client';

const router = Router();
router.use(authenticate);

const documentItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(10000).default(0),
  vatIncluded: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const createDocumentSchema = z.object({
  documentType: z.enum(['INVOICE', 'RECEIPT', 'RECEIPT_INVOICE', 'CREDIT_NOTE', 'DELIVERY_NOTE']),
  customerId: z.string().uuid().optional().nullable(),
  issueDate: z.string(),
  dueDate: z.string().optional().nullable(),
  currency: z.enum(['ILS', 'USD', 'EUR']).default('ILS'),
  notes: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CHECK', 'BANK_TRANSFER', 'CREDIT_CARD', 'OTHER']).optional().nullable(),
  paymentReference: z.string().optional(),
  items: z.array(documentItemSchema).min(1, 'חייב להוסיף לפחות פריט אחד'),
  originalDocumentId: z.string().uuid().optional().nullable(),
  asDraft: z.boolean().default(false),
  // Allocation options when API rejects
  allocationAction: z.enum(['request', 'continue_without', 'cancel', 'reverse_charge']).optional(),
});

// List documents
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status, customerId, page = '1', limit = '20' } = req.query;
    const where: Record<string, unknown> = { businessId: req.user!.businessId };

    if (type) where.documentType = type;
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.document.count({ where }),
    ]);

    res.json({ documents, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת מסמכים' });
  }
});

// Get single document
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { customer: true, items: { orderBy: { sortOrder: 'asc' } }, creditNotes: true },
    });
    if (!document) {
      res.status(404).json({ error: 'מסמך לא נמצא' });
      return;
    }
    res.json(document);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת מסמך' });
  }
});

// Check allocation requirement (pre-check before creating)
router.post('/check-allocation', validate(z.object({
  documentType: z.string(),
  customerId: z.string().uuid().optional().nullable(),
  subtotal: z.number().int(),
  vatRate: z.number().int(),
})), async (req: Request, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    if (!business) {
      res.status(404).json({ error: 'עסק לא נמצא' });
      return;
    }

    let customer = null;
    if (req.body.customerId) {
      customer = await prisma.customer.findFirst({
        where: { id: req.body.customerId, businessId: req.user!.businessId },
      });
    }

    const required = isAllocationRequired(business, req.body, customer);
    const hasCredentials = hasAllocationCredentials(business);

    res.json({
      required,
      hasCredentials,
      threshold: getAllocationThreshold(),
      missingCredentials: required && !hasCredentials,
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בבדיקת הקצאה' });
  }
});

// Create document
router.post('/', validate(createDocumentSchema), async (req: Request, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    if (!business) {
      res.status(404).json({ error: 'עסק לא נמצא' });
      return;
    }

    const { documentType, customerId, issueDate, dueDate, currency, notes,
            paymentMethod, paymentReference, items, originalDocumentId, asDraft,
            allocationAction } = req.body;

    // Validate document type for business type
    const isOsekPatur = business.businessType === 'OSEK_PATUR';
    if (isOsekPatur && !['INVOICE', 'RECEIPT'].includes(documentType)) {
      res.status(400).json({ error: 'סוג מסמך לא זמין לעוסק פטור' });
      return;
    }

    // Credit note must reference original document
    if (documentType === 'CREDIT_NOTE' && !originalDocumentId) {
      res.status(400).json({ error: 'חשבונית זיכוי חייבת להפנות למסמך מקורי' });
      return;
    }

    // Calculate line totals and document totals
    const calculatedItems = items.map((item: z.infer<typeof documentItemSchema>) => ({
      ...item,
      lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
    }));

    const vatRate = isOsekPatur ? 0 : getVatRate();
    const totals = calculateDocumentTotals(
      items as Array<{ quantity: number; unitPrice: number; discountPercent: number }>,
      isOsekPatur,
      vatRate,
    );

    // Get customer if specified
    let customer = null;
    if (customerId) {
      customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId: business.id },
      });
    }

    // Check allocation requirement
    const needsAllocation = !isOsekPatur && !asDraft && isAllocationRequired(
      business,
      { subtotal: totals.subtotal, vatRate, documentType },
      customer,
    );

    // If allocation needed but no credentials, block
    if (needsAllocation && !hasAllocationCredentials(business) && allocationAction !== 'cancel') {
      res.status(400).json({
        error: 'יש להגדיר חיבור לחשבונית ישראל בהגדרות לפני הפקת מסמך זה',
        code: 'ALLOCATION_NO_CREDENTIALS',
      });
      return;
    }

    // Get document number (only for non-drafts)
    const isDraft = asDraft === true;
    let documentNumber = 0;
    if (!isDraft) {
      documentNumber = await getNextDocumentNumber(prisma, business.id, documentType as DocumentType);
    }

    const document = await prisma.document.create({
      data: {
        businessId: business.id,
        customerId: customerId || null,
        documentType: documentType as DocumentType,
        documentNumber,
        issueDate: new Date(issueDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: isDraft ? 'DRAFT' : 'SENT',
        currency,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        total: totals.total,
        vatRate,
        notes,
        paymentMethod: paymentMethod || null,
        paymentReference,
        originalDocumentId: originalDocumentId || null,
        allocationStatus: needsAllocation ? 'PENDING' : 'NOT_REQUIRED',
        items: {
          create: calculatedItems.map((item: z.infer<typeof documentItemSchema> & { lineTotal: number }) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            lineTotal: item.lineTotal,
            vatIncluded: item.vatIncluded,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { customer: true, items: true },
    });

    // Handle allocation for non-drafts
    if (!isDraft && needsAllocation && customer) {
      const allocationResult = await requestAllocationNumber(business, document, customer);

      if (allocationResult.status === 'APPROVED') {
        // Success — allocation number saved by the service
      } else if (allocationResult.status === 'FAILED') {
        // API rejected — check what user wants to do
        if (allocationAction === 'continue_without') {
          // User chose to continue without allocation
          await markAllocationFailed(document.id);
        } else if (allocationAction === 'reverse_charge' && customer?.taxId) {
          // Reverse charge: create cancellation + zero-VAT invoice
          // 1. Cancel current document
          await prisma.document.update({
            where: { id: document.id },
            data: { status: 'CANCELLED', allocationStatus: 'SKIPPED' },
          });

          // 2. Create credit note (cancellation)
          const creditNoteNumber = await getNextDocumentNumber(prisma, business.id, 'CREDIT_NOTE');
          await prisma.document.create({
            data: {
              businessId: business.id,
              customerId: customerId || null,
              documentType: 'CREDIT_NOTE',
              documentNumber: creditNoteNumber,
              issueDate: new Date(issueDate),
              status: 'SENT',
              currency,
              subtotal: -totals.subtotal,
              vatAmount: -totals.vatAmount,
              total: -totals.total,
              vatRate,
              notes: `ביטול בגין סירוב חשבונית ישראל — מסמך מקורי מס' ${documentNumber}`,
              originalDocumentId: document.id,
              allocationStatus: 'NOT_REQUIRED',
              items: {
                create: calculatedItems.map((item: z.infer<typeof documentItemSchema> & { lineTotal: number }, i: number) => ({
                  description: item.description,
                  quantity: -item.quantity,
                  unitPrice: item.unitPrice,
                  discountPercent: item.discountPercent,
                  lineTotal: -item.lineTotal,
                  vatIncluded: item.vatIncluded,
                  sortOrder: i,
                })),
              },
            },
          });

          // 3. Create new invoice with 0% VAT (reverse charge)
          const newInvoiceNumber = await getNextDocumentNumber(prisma, business.id, documentType as DocumentType);
          const reverseChargeDoc = await prisma.document.create({
            data: {
              businessId: business.id,
              customerId: customerId || null,
              documentType: documentType as DocumentType,
              documentNumber: newInvoiceNumber,
              issueDate: new Date(issueDate),
              dueDate: dueDate ? new Date(dueDate) : null,
              status: 'SENT',
              currency,
              subtotal: totals.subtotal,
              vatAmount: 0,
              total: totals.subtotal,
              vatRate: 0,
              notes: `בגין חשבונית זו הלקוח חייב לדווח חשבונית עצמית\n${notes || ''}`.trim(),
              paymentMethod: paymentMethod || null,
              paymentReference,
              allocationStatus: 'NOT_REQUIRED',
              items: {
                create: calculatedItems.map((item: z.infer<typeof documentItemSchema> & { lineTotal: number }) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountPercent: item.discountPercent,
                  lineTotal: item.lineTotal,
                  vatIncluded: item.vatIncluded,
                  sortOrder: item.sortOrder,
                })),
              },
            },
            include: { customer: true, items: true },
          });

          // Generate PDF and cashbook for the reverse charge doc
          try {
            const pdfUrl = await generatePdf(reverseChargeDoc, business);
            await prisma.document.update({
              where: { id: reverseChargeDoc.id },
              data: { pdfUrl },
            });
          } catch (err) {
            console.error('PDF generation error:', err);
          }
          await createCashbookEntry(reverseChargeDoc, business);

          res.status(201).json({
            ...reverseChargeDoc,
            allocationResult,
            reverseCharge: true,
            originalCancelledId: document.id,
          });
          return;
        } else {
          // Return the allocation failure for frontend to handle
          const refreshedDoc = await prisma.document.findUnique({
            where: { id: document.id },
            include: { customer: true, items: true },
          });

          res.status(201).json({
            ...refreshedDoc,
            allocationResult,
            allocationPending: true,
          });
          return;
        }
      }
    }

    // Reload document to get updated allocation fields
    const finalDoc = await prisma.document.findUnique({
      where: { id: document.id },
      include: { customer: true, items: true },
    });

    // Generate PDF and create cashbook entry for non-drafts
    if (!isDraft && finalDoc) {
      try {
        const pdfUrl = await generatePdf(finalDoc, business);
        await prisma.document.update({
          where: { id: finalDoc.id },
          data: { pdfUrl },
        });
        finalDoc.pdfUrl = pdfUrl;
      } catch (err) {
        console.error('PDF generation error:', err);
      }

      await createCashbookEntry(finalDoc, business);

      // Mark original as CREDIT_NOTED if this is a credit note
      if (documentType === 'CREDIT_NOTE' && originalDocumentId) {
        await prisma.document.update({
          where: { id: originalDocumentId },
          data: { status: 'CREDIT_NOTED' },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: isDraft ? 'CREATE_DRAFT' : 'CREATE_DOCUMENT',
        entityType: 'document',
        entityId: document.id,
        details: JSON.stringify({ documentType, documentNumber, allocationStatus: finalDoc?.allocationStatus }),
      },
    });

    res.status(201).json(finalDoc);
  } catch (error) {
    console.error('Document creation error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת מסמך' });
  }
});

// Resolve allocation — user chose action after API failure
router.post('/:id/resolve-allocation', async (req: Request, res: Response) => {
  try {
    const { action } = req.body; // 'continue_without' | 'cancel'

    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        businessId: req.user!.businessId,
        allocationStatus: 'PENDING',
      },
      include: { customer: true, items: true },
    });
    if (!document) {
      res.status(404).json({ error: 'מסמך לא נמצא או שכבר טופל' });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    if (!business) {
      res.status(404).json({ error: 'עסק לא נמצא' });
      return;
    }

    if (action === 'continue_without') {
      await markAllocationFailed(document.id);

      // Generate PDF with warning
      try {
        const updatedDoc = await prisma.document.findUnique({
          where: { id: document.id },
          include: { customer: true, items: true },
        });
        if (updatedDoc) {
          const pdfUrl = await generatePdf(updatedDoc, business);
          await prisma.document.update({
            where: { id: document.id },
            data: { pdfUrl },
          });
        }
      } catch (err) {
        console.error('PDF generation error:', err);
      }

      const result = await prisma.document.findUnique({
        where: { id: document.id },
        include: { customer: true, items: true },
      });
      res.json(result);
    } else if (action === 'cancel') {
      // Revert to draft
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'DRAFT', allocationStatus: 'SKIPPED', documentNumber: 0 },
      });

      const result = await prisma.document.findUnique({
        where: { id: document.id },
        include: { customer: true, items: true },
      });
      res.json(result);
    } else {
      res.status(400).json({ error: 'פעולה לא תקינה' });
    }
  } catch {
    res.status(500).json({ error: 'שגיאה בטיפול בהקצאה' });
  }
});

// Finalize draft
router.post('/:id/finalize', async (req: Request, res: Response) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId, status: 'DRAFT' },
      include: { customer: true, items: true },
    });
    if (!document) {
      res.status(404).json({ error: 'טיוטה לא נמצאה' });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    if (!business) {
      res.status(404).json({ error: 'עסק לא נמצא' });
      return;
    }

    const documentNumber = await getNextDocumentNumber(prisma, business.id, document.documentType);

    // Check allocation requirement
    const needsAllocation = isAllocationRequired(
      business,
      { subtotal: document.subtotal, vatRate: document.vatRate, documentType: document.documentType },
      document.customer,
    );

    if (needsAllocation && !hasAllocationCredentials(business)) {
      res.status(400).json({
        error: 'יש להגדיר חיבור לחשבונית ישראל בהגדרות לפני הפקת מסמך זה',
        code: 'ALLOCATION_NO_CREDENTIALS',
      });
      return;
    }

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: 'SENT',
        documentNumber,
        allocationStatus: needsAllocation ? 'PENDING' : 'NOT_REQUIRED',
      },
      include: { customer: true, items: true },
    });

    // Request allocation if needed
    if (needsAllocation && updated.customer) {
      const allocationResult = await requestAllocationNumber(business, updated, updated.customer);
      if (allocationResult.status === 'FAILED') {
        // Return with allocation pending for frontend handling
        const refreshedDoc = await prisma.document.findUnique({
          where: { id: updated.id },
          include: { customer: true, items: true },
        });
        res.json({ ...refreshedDoc, allocationResult, allocationPending: true });
        return;
      }
    }

    // Reload with allocation data
    const finalDoc = await prisma.document.findUnique({
      where: { id: updated.id },
      include: { customer: true, items: true },
    });

    if (finalDoc) {
      try {
        const pdfUrl = await generatePdf(finalDoc, business);
        await prisma.document.update({
          where: { id: finalDoc.id },
          data: { pdfUrl },
        });
        finalDoc.pdfUrl = pdfUrl;
      } catch (err) {
        console.error('PDF generation error:', err);
      }

      await createCashbookEntry(finalDoc, business);
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'FINALIZE_DOCUMENT',
        entityType: 'document',
        entityId: updated.id,
      },
    });

    res.json(finalDoc);
  } catch {
    res.status(500).json({ error: 'שגיאה בהפקת המסמך' });
  }
});

// Test allocation connection
router.post('/test-allocation', async (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
      res.status(400).json({ error: 'חובה למלא Client ID ו-Client Secret' });
      return;
    }
    const result = await testAllocationConnection(clientId, clientSecret);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'שגיאה בבדיקת החיבור' });
  }
});

// Get allocation info
router.get('/allocation-info', async (_req: Request, res: Response) => {
  res.json({ threshold: getAllocationThreshold() });
});

// Mark as paid
router.post('/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    const { paymentMethod, paymentReference } = req.body;

    const document = await prisma.document.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    });
    if (!document) {
      res.status(404).json({ error: 'מסמך לא נמצא' });
      return;
    }
    if (document.status === 'CANCELLED' || document.status === 'CREDIT_NOTED') {
      res.status(400).json({ error: 'לא ניתן לסמן מסמך מבוטל כשולם' });
      return;
    }

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: 'PAID',
        paymentMethod: paymentMethod || document.paymentMethod,
        paymentReference: paymentReference || document.paymentReference,
      },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון סטטוס' });
  }
});

// Send document by email
router.post('/:id/send-email', async (req: Request, res: Response) => {
  try {
    const { recipientEmail } = req.body;
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { customer: true, items: true },
    });
    if (!document) {
      res.status(404).json({ error: 'מסמך לא נמצא' });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    if (!business) {
      res.status(404).json({ error: 'עסק לא נמצא' });
      return;
    }

    const email = recipientEmail || document.customer?.email;
    if (!email) {
      res.status(400).json({ error: 'לא צוינה כתובת מייל' });
      return;
    }

    await sendDocumentEmail(document, business, email);
    res.json({ message: 'המסמך נשלח בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה בשליחת המסמך' });
  }
});

// Send document by WhatsApp
router.post('/:id/send-whatsapp', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { customer: true },
    });
    if (!document) {
      res.status(404).json({ error: 'מסמך לא נמצא' });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });

    const phoneNumber = phone || document.customer?.phone;
    if (!phoneNumber) {
      res.status(400).json({ error: 'לא צוין מספר טלפון' });
      return;
    }

    const result = await sendWhatsApp(document, business!, phoneNumber);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'שגיאה בשליחת WhatsApp' });
  }
});

// Download PDF
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { customer: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!document) {
      res.status(404).json({ error: 'מסמך לא נמצא' });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    if (!business) {
      res.status(404).json({ error: 'עסק לא נמצא' });
      return;
    }

    const pdfUrl = await generatePdf(document, business);

    await prisma.document.update({
      where: { id: document.id },
      data: { pdfUrl },
    });

    res.json({ pdfUrl });
  } catch {
    res.status(500).json({ error: 'שגיאה ביצירת PDF' });
  }
});

export default router;

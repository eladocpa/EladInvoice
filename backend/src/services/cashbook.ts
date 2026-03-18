import { prisma } from '../utils/prisma';
import { Business, Document } from '@prisma/client';

/**
 * Automatically create a cashbook entry when a document is finalized.
 */
export async function createCashbookEntry(
  document: Document,
  business: Business,
): Promise<void> {
  // Only create entries for relevant document types
  const incomeTypes = ['INVOICE', 'RECEIPT_INVOICE', 'RECEIPT'];
  const creditType = 'CREDIT_NOTE';

  if (!incomeTypes.includes(document.documentType) && document.documentType !== creditType) {
    return;
  }

  // Get customer name
  let customerName: string | null = null;
  if (document.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: document.customerId },
    });
    customerName = customer?.name || null;
  }

  // Calculate running balance
  const lastEntry = await prisma.cashbookEntry.findFirst({
    where: { businessId: business.id },
    orderBy: { createdAt: 'desc' },
  });
  const previousBalance = lastEntry?.runningBalance || 0;

  const isCreditNote = document.documentType === creditType;
  const amount = isCreditNote ? -document.total : document.total;
  const vatAmount = isCreditNote ? -document.vatAmount : document.vatAmount;
  const runningBalance = previousBalance + amount;

  const typeLabels: Record<string, string> = {
    INVOICE: 'חשבונית מס',
    RECEIPT_INVOICE: 'חשבונית מס קבלה',
    RECEIPT: 'קבלה',
    CREDIT_NOTE: 'חשבונית זיכוי',
  };

  await prisma.cashbookEntry.create({
    data: {
      businessId: business.id,
      documentId: document.id,
      entryType: isCreditNote ? 'EXPENSE' : 'INCOME',
      entryDate: document.issueDate,
      amount,
      vatAmount,
      customerOrSupplierName: customerName,
      description: `${typeLabels[document.documentType] || document.documentType} מס' ${document.documentNumber}`,
      paymentMethod: document.paymentMethod,
      paymentReference: document.paymentReference,
      runningBalance,
    },
  });
}

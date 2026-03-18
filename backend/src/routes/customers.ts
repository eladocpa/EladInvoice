import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  name: z.string().min(2, 'שם לקוח חייב להכיל לפחות 2 תווים'),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

// List customers
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const where: Record<string, unknown> = { businessId: req.user!.businessId };

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(customers);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת לקוחות' });
  }
});

// Get single customer
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    });
    if (!customer) {
      res.status(404).json({ error: 'לקוח לא נמצא' });
      return;
    }
    res.json(customer);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת לקוח' });
  }
});

// Create customer
router.post('/', validate(customerSchema), async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.create({
      data: {
        ...req.body,
        businessId: req.user!.businessId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE_CUSTOMER',
        entityType: 'customer',
        entityId: customer.id,
      },
    });

    res.status(201).json(customer);
  } catch {
    res.status(500).json({ error: 'שגיאה ביצירת לקוח' });
  }
});

// Update customer
router.put('/:id', validate(customerSchema), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    });
    if (!existing) {
      res.status(404).json({ error: 'לקוח לא נמצא' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE_CUSTOMER',
        entityType: 'customer',
        entityId: customer.id,
        details: JSON.stringify(req.body),
      },
    });

    res.json(customer);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון לקוח' });
  }
});

// Delete customer (only if no documents)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { documents: { take: 1 } },
    });
    if (!existing) {
      res.status(404).json({ error: 'לקוח לא נמצא' });
      return;
    }
    if (existing.documents.length > 0) {
      res.status(400).json({ error: 'לא ניתן למחוק לקוח עם מסמכים קיימים' });
      return;
    }

    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ message: 'לקוח נמחק בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה במחיקת לקוח' });
  }
});

export default router;

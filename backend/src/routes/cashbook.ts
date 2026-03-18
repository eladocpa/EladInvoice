import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Get cashbook entries
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page = '1', limit = '50' } = req.query;
    const where: Record<string, unknown> = { businessId: req.user!.businessId };

    if (startDate || endDate) {
      where.entryDate = {};
      if (startDate) (where.entryDate as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.entryDate as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [entries, total] = await Promise.all([
      prisma.cashbookEntry.findMany({
        where,
        include: { document: { select: { documentType: true, documentNumber: true } } },
        orderBy: { entryDate: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.cashbookEntry.count({ where }),
    ]);

    // Calculate summary
    const allEntries = await prisma.cashbookEntry.findMany({
      where,
      select: { amount: true, vatAmount: true, entryType: true },
    });

    const summary = allEntries.reduce(
      (acc, entry) => {
        if (entry.entryType === 'INCOME') {
          acc.totalIncome += entry.amount;
          acc.totalVat += entry.vatAmount;
        } else {
          acc.totalExpense += entry.amount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, totalVat: 0 },
    );

    res.json({
      entries,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
      summary: {
        ...summary,
        balance: summary.totalIncome - summary.totalExpense,
      },
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת ספר תקבולים' });
  }
});

export default router;

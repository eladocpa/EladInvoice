import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import ExcelJS from 'exceljs';

const router = Router();
router.use(authenticate);

// Income report
router.get('/income', async (req: Request, res: Response) => {
  try {
    const { period, year, month, quarter, startDate, endDate } = req.query;
    const businessId = req.user!.businessId;

    let dateFrom: Date;
    let dateTo: Date;
    const y = parseInt(year as string) || new Date().getFullYear();

    switch (period) {
      case 'monthly':
        const m = parseInt(month as string) || new Date().getMonth() + 1;
        dateFrom = new Date(y, m - 1, 1);
        dateTo = new Date(y, m, 0, 23, 59, 59);
        break;
      case 'quarterly':
        const q = parseInt(quarter as string) || Math.ceil((new Date().getMonth() + 1) / 3);
        dateFrom = new Date(y, (q - 1) * 3, 1);
        dateTo = new Date(y, q * 3, 0, 23, 59, 59);
        break;
      case 'yearly':
        dateFrom = new Date(y, 0, 1);
        dateTo = new Date(y, 11, 31, 23, 59, 59);
        break;
      case 'custom':
        dateFrom = new Date(startDate as string);
        dateTo = new Date(endDate as string);
        dateTo.setHours(23, 59, 59);
        break;
      default:
        dateFrom = new Date(y, new Date().getMonth(), 1);
        dateTo = new Date(y, new Date().getMonth() + 1, 0, 23, 59, 59);
    }

    const documents = await prisma.document.findMany({
      where: {
        businessId,
        issueDate: { gte: dateFrom, lte: dateTo },
        status: { in: ['SENT', 'PAID'] },
        documentType: { in: ['INVOICE', 'RECEIPT_INVOICE', 'RECEIPT'] },
      },
      include: { customer: true },
      orderBy: { issueDate: 'asc' },
    });

    // Summary
    const totalGross = documents.reduce((sum, d) => sum + d.total, 0);
    const totalVat = documents.reduce((sum, d) => sum + d.vatAmount, 0);
    const totalNet = documents.reduce((sum, d) => sum + d.subtotal, 0);

    // By customer
    const byCustomer: Record<string, { name: string; total: number; count: number }> = {};
    documents.forEach((d) => {
      const key = d.customerId || 'anonymous';
      const name = d.customer?.name || 'לקוח ללא שם';
      if (!byCustomer[key]) byCustomer[key] = { name, total: 0, count: 0 };
      byCustomer[key].total += d.total;
      byCustomer[key].count += 1;
    });

    // By payment method
    const byPaymentMethod: Record<string, { total: number; count: number }> = {};
    documents.forEach((d) => {
      const method = d.paymentMethod || 'OTHER';
      if (!byPaymentMethod[method]) byPaymentMethod[method] = { total: 0, count: 0 };
      byPaymentMethod[method].total += d.total;
      byPaymentMethod[method].count += 1;
    });

    // Monthly breakdown
    const byMonth: Record<string, number> = {};
    documents.forEach((d) => {
      const monthKey = `${d.issueDate.getFullYear()}-${String(d.issueDate.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + d.total;
    });

    res.json({
      period: { from: dateFrom, to: dateTo },
      totalGross,
      totalVat,
      totalNet,
      documentCount: documents.length,
      byCustomer: Object.values(byCustomer).sort((a, b) => b.total - a.total),
      byPaymentMethod,
      byMonth,
      documents,
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת דוח' });
  }
});

// Export report to Excel
router.get('/income/excel', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const businessId = req.user!.businessId;

    const dateFrom = new Date(startDate as string || new Date().getFullYear() + '-01-01');
    const dateTo = new Date(endDate as string || new Date().toISOString());
    dateTo.setHours(23, 59, 59);

    const business = await prisma.business.findUnique({ where: { id: businessId } });

    const documents = await prisma.document.findMany({
      where: {
        businessId,
        issueDate: { gte: dateFrom, lte: dateTo },
        status: { in: ['SENT', 'PAID'] },
      },
      include: { customer: true },
      orderBy: { issueDate: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('דוח הכנסות');

    // RTL
    sheet.views = [{ rightToLeft: true }];

    sheet.columns = [
      { header: 'תאריך', key: 'date', width: 15 },
      { header: 'סוג מסמך', key: 'type', width: 18 },
      { header: 'מספר', key: 'number', width: 10 },
      { header: 'לקוח', key: 'customer', width: 25 },
      { header: 'סכום לפני מע"מ', key: 'subtotal', width: 18 },
      { header: 'מע"מ', key: 'vat', width: 15 },
      { header: 'סה"כ', key: 'total', width: 18 },
      { header: 'אמצעי תשלום', key: 'payment', width: 15 },
      { header: 'סטטוס', key: 'status', width: 12 },
    ];

    const typeNames: Record<string, string> = {
      INVOICE: 'חשבונית מס',
      RECEIPT: 'קבלה',
      RECEIPT_INVOICE: 'חשבונית מס קבלה',
      CREDIT_NOTE: 'חשבונית זיכוי',
      DELIVERY_NOTE: 'תעודת משלוח',
    };

    const statusNames: Record<string, string> = {
      SENT: 'נשלח',
      PAID: 'שולם',
      CANCELLED: 'בוטל',
      CREDIT_NOTED: 'זוכה',
    };

    const paymentNames: Record<string, string> = {
      CASH: 'מזומן',
      CHECK: 'שיק',
      BANK_TRANSFER: 'העברה בנקאית',
      CREDIT_CARD: 'כרטיס אשראי',
      OTHER: 'אחר',
    };

    documents.forEach((d) => {
      sheet.addRow({
        date: d.issueDate.toLocaleDateString('he-IL'),
        type: typeNames[d.documentType] || d.documentType,
        number: d.documentNumber,
        customer: d.customer?.name || '',
        subtotal: d.subtotal / 100,
        vat: d.vatAmount / 100,
        total: d.total / 100,
        payment: d.paymentMethod ? paymentNames[d.paymentMethod] || d.paymentMethod : '',
        status: statusNames[d.status] || d.status,
      });
    });

    // Add totals row
    const totalRow = sheet.addRow({
      date: 'סה"כ',
      subtotal: documents.reduce((s, d) => s + d.subtotal, 0) / 100,
      vat: documents.reduce((s, d) => s + d.vatAmount, 0) / 100,
      total: documents.reduce((s, d) => s + d.total, 0) / 100,
    });
    totalRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=income-report-${business?.name || 'report'}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch {
    res.status(500).json({ error: 'שגיאה בייצוא לאקסל' });
  }
});

// Dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      monthlyIncome,
      monthlyDocs,
      pendingPayment,
      activeCustomers,
      recentDocuments,
      yearlyMonthly,
    ] = await Promise.all([
      // Total income this month
      prisma.document.aggregate({
        where: {
          businessId,
          issueDate: { gte: startOfMonth },
          status: { in: ['SENT', 'PAID'] },
          documentType: { in: ['INVOICE', 'RECEIPT_INVOICE', 'RECEIPT'] },
        },
        _sum: { total: true },
      }),
      // Documents this month
      prisma.document.count({
        where: {
          businessId,
          issueDate: { gte: startOfMonth },
          status: { not: 'DRAFT' },
        },
      }),
      // Pending payment
      prisma.document.count({
        where: {
          businessId,
          status: 'SENT',
          documentType: { in: ['INVOICE', 'RECEIPT_INVOICE'] },
        },
      }),
      // Active customers (with docs this year)
      prisma.document.groupBy({
        by: ['customerId'],
        where: {
          businessId,
          issueDate: { gte: startOfYear },
          customerId: { not: null },
        },
      }),
      // Recent documents
      prisma.document.findMany({
        where: { businessId, status: { not: 'DRAFT' } },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Monthly income for the past 12 months
      prisma.document.findMany({
        where: {
          businessId,
          issueDate: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
          status: { in: ['SENT', 'PAID'] },
          documentType: { in: ['INVOICE', 'RECEIPT_INVOICE', 'RECEIPT'] },
        },
        select: { issueDate: true, total: true },
      }),
    ]);

    // Aggregate monthly
    const monthlyData: Record<string, number> = {};
    yearlyMonthly.forEach((d) => {
      const key = `${d.issueDate.getFullYear()}-${String(d.issueDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + d.total;
    });

    res.json({
      monthlyIncome: monthlyIncome._sum.total || 0,
      monthlyDocuments: monthlyDocs,
      pendingPayment,
      activeCustomers: activeCustomers.length,
      recentDocuments,
      monthlyChart: monthlyData,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני דשבורד' });
  }
});

export default router;

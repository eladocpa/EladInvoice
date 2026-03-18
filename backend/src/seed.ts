import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean up
  await prisma.auditLog.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.cashbookEntry.deleteMany();
  await prisma.documentItem.deleteMany();
  await prisma.document.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 12);

  // ========== Business 1: Osek Murshe ==========
  const business1 = await prisma.business.create({
    data: {
      name: 'סטודיו דיגיטל פלוס',
      businessType: 'OSEK_MURSHE',
      taxId: '515123456',
      vatNumber: '515123456',
      address: 'רחוב הרצל 15',
      city: 'תל אביב',
      phone: '03-1234567',
      email: 'info@digitalplus.co.il',
      primaryColor: '#6C63FF',
      secondaryColor: '#00D4AA',
      bankName: 'לאומי',
      bankBranch: '689',
      bankAccount: '12345678',
    },
  });

  const user1 = await prisma.user.create({
    data: {
      businessId: business1.id,
      email: 'demo@digitalplus.co.il',
      passwordHash,
      name: 'ישראל ישראלי',
      role: 'OWNER',
    },
  });

  const customer1a = await prisma.customer.create({
    data: {
      businessId: business1.id,
      name: 'חברת אלפא בע"מ',
      taxId: '512345678',
      address: 'רחוב ביאליק 20',
      city: 'רמת גן',
      phone: '03-9876543',
      email: 'office@alpha.co.il',
    },
  });

  const customer1b = await prisma.customer.create({
    data: {
      businessId: business1.id,
      name: 'משה כהן',
      phone: '050-1111111',
      email: 'moshe@example.com',
    },
  });

  const customer1c = await prisma.customer.create({
    data: {
      businessId: business1.id,
      name: 'סופטוור גלובל בע"מ',
      taxId: '514567890',
      address: 'מגדלי אלון, רחוב יגאל אלון 94',
      city: 'תל אביב',
      phone: '03-5551234',
      email: 'accounts@softglobal.co.il',
    },
  });

  // Create some documents for business 1
  const doc1 = await prisma.document.create({
    data: {
      businessId: business1.id,
      customerId: customer1a.id,
      documentType: 'INVOICE',
      documentNumber: 1,
      issueDate: new Date('2026-01-15'),
      dueDate: new Date('2026-02-15'),
      status: 'PAID',
      subtotal: 500000,
      vatAmount: 90000,
      total: 590000,
      vatRate: 18,
      paymentMethod: 'BANK_TRANSFER',
      items: {
        create: [
          { description: 'עיצוב אתר אינטרנט', quantity: 100, unitPrice: 350000, discountPercent: 0, lineTotal: 350000, sortOrder: 0 },
          { description: 'SEO — אופטימיזציה למנועי חיפוש', quantity: 100, unitPrice: 150000, discountPercent: 0, lineTotal: 150000, sortOrder: 1 },
        ],
      },
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      businessId: business1.id,
      customerId: customer1b.id,
      documentType: 'RECEIPT_INVOICE',
      documentNumber: 1,
      issueDate: new Date('2026-02-01'),
      status: 'SENT',
      subtotal: 200000,
      vatAmount: 36000,
      total: 236000,
      vatRate: 18,
      paymentMethod: 'CREDIT_CARD',
      items: {
        create: [
          { description: 'ניהול קמפיין גוגל — חודש פברואר', quantity: 100, unitPrice: 200000, discountPercent: 0, lineTotal: 200000, sortOrder: 0 },
        ],
      },
    },
  });

  const doc3 = await prisma.document.create({
    data: {
      businessId: business1.id,
      customerId: customer1c.id,
      documentType: 'INVOICE',
      documentNumber: 2,
      issueDate: new Date('2026-03-01'),
      dueDate: new Date('2026-03-30'),
      status: 'SENT',
      subtotal: 1200000,
      vatAmount: 216000,
      total: 1416000,
      vatRate: 18,
      paymentMethod: 'BANK_TRANSFER',
      items: {
        create: [
          { description: 'פיתוח אפליקציית מובייל — שלב 1', quantity: 100, unitPrice: 800000, discountPercent: 0, lineTotal: 800000, sortOrder: 0 },
          { description: 'UI/UX Design', quantity: 100, unitPrice: 400000, discountPercent: 0, lineTotal: 400000, sortOrder: 1 },
        ],
      },
    },
  });

  // Cashbook entries for business 1
  await prisma.cashbookEntry.create({
    data: {
      businessId: business1.id,
      documentId: doc1.id,
      entryType: 'INCOME',
      entryDate: new Date('2026-01-15'),
      amount: 590000,
      vatAmount: 90000,
      customerOrSupplierName: 'חברת אלפא בע"מ',
      description: 'חשבונית מס מס\' 1',
      paymentMethod: 'BANK_TRANSFER',
      runningBalance: 590000,
    },
  });

  await prisma.cashbookEntry.create({
    data: {
      businessId: business1.id,
      documentId: doc2.id,
      entryType: 'INCOME',
      entryDate: new Date('2026-02-01'),
      amount: 236000,
      vatAmount: 36000,
      customerOrSupplierName: 'משה כהן',
      description: 'חשבונית מס קבלה מס\' 1',
      paymentMethod: 'CREDIT_CARD',
      runningBalance: 826000,
    },
  });

  await prisma.cashbookEntry.create({
    data: {
      businessId: business1.id,
      documentId: doc3.id,
      entryType: 'INCOME',
      entryDate: new Date('2026-03-01'),
      amount: 1416000,
      vatAmount: 216000,
      customerOrSupplierName: 'סופטוור גלובל בע"מ',
      description: 'חשבונית מס מס\' 2',
      paymentMethod: 'BANK_TRANSFER',
      runningBalance: 2242000,
    },
  });

  // Update next numbers
  await prisma.business.update({
    where: { id: business1.id },
    data: { nextInvoiceNumber: 3, nextReceiptInvoiceNumber: 2 },
  });

  // ========== Business 2: Osek Patur ==========
  const business2 = await prisma.business.create({
    data: {
      name: 'שירה לוי — עיצוב גרפי',
      businessType: 'OSEK_PATUR',
      taxId: '312345678',
      address: 'רחוב סוקולוב 8',
      city: 'הרצליה',
      phone: '050-9876543',
      email: 'shira@design.co.il',
      primaryColor: '#E91E63',
      secondaryColor: '#FF9800',
    },
  });

  await prisma.user.create({
    data: {
      businessId: business2.id,
      email: 'demo@osekpatur.co.il',
      passwordHash,
      name: 'שירה לוי',
      role: 'OWNER',
    },
  });

  const customer2a = await prisma.customer.create({
    data: {
      businessId: business2.id,
      name: 'קפה רוטשילד',
      phone: '050-2222222',
      email: 'cafe@rothschild.co.il',
    },
  });

  const doc4 = await prisma.document.create({
    data: {
      businessId: business2.id,
      customerId: customer2a.id,
      documentType: 'INVOICE',
      documentNumber: 1,
      issueDate: new Date('2026-02-10'),
      status: 'PAID',
      subtotal: 250000,
      vatAmount: 0,
      total: 250000,
      vatRate: 0,
      paymentMethod: 'CASH',
      items: {
        create: [
          { description: 'עיצוב תפריט חדש', quantity: 100, unitPrice: 150000, discountPercent: 0, lineTotal: 150000, sortOrder: 0 },
          { description: 'עיצוב כרטיסי ביקור', quantity: 200, unitPrice: 50000, discountPercent: 0, lineTotal: 100000, sortOrder: 1 },
        ],
      },
    },
  });

  await prisma.cashbookEntry.create({
    data: {
      businessId: business2.id,
      documentId: doc4.id,
      entryType: 'INCOME',
      entryDate: new Date('2026-02-10'),
      amount: 250000,
      vatAmount: 0,
      customerOrSupplierName: 'קפה רוטשילד',
      description: 'חשבונית עסקה מס\' 1',
      paymentMethod: 'CASH',
      runningBalance: 250000,
    },
  });

  await prisma.business.update({
    where: { id: business2.id },
    data: { nextInvoiceNumber: 2 },
  });

  console.log('Seeding complete!');
  console.log('');
  console.log('Demo accounts:');
  console.log('  Osek Murshe: demo@digitalplus.co.il / password123');
  console.log('  Osek Patur:  demo@osekpatur.co.il / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import nodemailer from 'nodemailer';
import { prisma } from '../utils/prisma';
import { Business, Document, Customer } from '@prisma/client';
import { formatCurrency } from '../utils/tax.utils';

type DocumentWithCustomer = Document & { customer: Customer | null };

const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  INVOICE: 'חשבונית',
  RECEIPT: 'קבלה',
  RECEIPT_INVOICE: 'חשבונית מס קבלה',
  CREDIT_NOTE: 'חשבונית זיכוי',
  DELIVERY_NOTE: 'תעודת משלוח',
};

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function generateEmailHtml(document: DocumentWithCustomer, business: Business): string {
  const docTypeName = DOCUMENT_TYPE_NAMES[document.documentType] || document.documentType;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; direction: rtl; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <div style="background: ${business.primaryColor}; color: white; padding: 25px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">${business.name}</h1>
      <p style="margin: 5px 0 0; opacity: 0.9;">${docTypeName} מספר ${document.documentNumber}</p>
    </div>

    <div style="padding: 25px;">
      <p style="font-size: 16px;">שלום ${document.customer?.name || 'לקוח יקר'},</p>

      <p>מצורפ/ת ${docTypeName} מספר <strong>${document.documentNumber}</strong> מתאריך ${new Date(document.issueDate).toLocaleDateString('he-IL')}.</p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>סכום:</strong> ${formatCurrency(document.total, document.currency)}</p>
        ${document.dueDate ? `<p style="margin: 5px 0;"><strong>לתשלום עד:</strong> ${new Date(document.dueDate).toLocaleDateString('he-IL')}</p>` : ''}
      </div>

      ${business.bankName ? `
      <div style="background: #e8f4fd; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <p style="margin: 0; font-weight: bold;">פרטי תשלום:</p>
        <p style="margin: 5px 0;">בנק: ${business.bankName} | סניף: ${business.bankBranch || '-'} | חשבון: ${business.bankAccount || '-'}</p>
      </div>` : ''}

      <p style="color: #666; font-size: 13px;">ה${docTypeName} מצורפ/ת כקובץ לנוחותך.</p>

      ${document.pdfUrl ? `<p><a href="${process.env.APP_URL}${document.pdfUrl}" style="display: inline-block; background: ${business.primaryColor}; color: white; padding: 10px 25px; border-radius: 6px; text-decoration: none;">צפייה במסמך</a></p>` : ''}
    </div>

    <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #999;">
      <p>${business.name} | ${business.phone || ''} | ${business.email || ''}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendDocumentEmail(
  document: DocumentWithCustomer,
  business: Business,
  recipientEmail: string,
): Promise<void> {
  const docTypeName = DOCUMENT_TYPE_NAMES[document.documentType] || document.documentType;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transporter = createTransporter();

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${business.name}" <${process.env.FROM_EMAIL}>`,
        to: recipientEmail,
        subject: `${docTypeName} מספר ${document.documentNumber} - ${business.name}`,
        html: generateEmailHtml(document, business),
      };

      // Attach PDF if exists
      if (document.pdfUrl) {
        const storagePath = process.env.STORAGE_PATH || './uploads';
        const filePath = storagePath + document.pdfUrl.replace('/uploads', '');
        mailOptions.attachments = [{
          filename: `${docTypeName}-${document.documentNumber}.html`,
          path: filePath,
        }];
      }

      await transporter.sendMail(mailOptions);

      await prisma.emailLog.create({
        data: {
          documentId: document.id,
          recipientEmail,
          status: 'sent',
        },
      });

      return;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';

      if (attempt === maxRetries) {
        await prisma.emailLog.create({
          data: {
            documentId: document.id,
            recipientEmail,
            status: 'failed',
            errorMessage: errMsg,
          },
        });
        throw error;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

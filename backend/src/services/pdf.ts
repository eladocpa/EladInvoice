import fs from 'fs';
import path from 'path';
import { Business, Document, DocumentItem, Customer } from '@prisma/client';
import { formatCurrency } from '../utils/tax.utils';
import { intToRate } from './exchange-rate';

type DocumentWithRelations = Document & {
  customer: Customer | null;
  items: DocumentItem[];
};

const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  INVOICE: 'חשבונית עסקה',
  RECEIPT: 'קבלה',
  RECEIPT_INVOICE: 'חשבונית מס קבלה',
  CREDIT_NOTE: 'חשבונית זיכוי',
  DELIVERY_NOTE: 'תעודת משלוח',
};

const PAYMENT_METHOD_NAMES: Record<string, string> = {
  CASH: 'מזומן',
  CHECK: 'שיק',
  BANK_TRANSFER: 'העברה בנקאית',
  CREDIT_CARD: 'כרטיס אשראי',
  OTHER: 'אחר',
};

const CURRENCY_NAMES: Record<string, string> = {
  ILS: 'שקל',
  USD: 'דולר',
  EUR: 'אירו',
  BTC: 'ביטקוין',
  ETH: 'את\'ריום',
  USDT: 'USDT',
  USDC: 'USDC',
};

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    ILS: '₪', USD: '$', EUR: '€',
    BTC: '₿', ETH: 'Ξ', USDT: '₮', USDC: '$',
  };
  return symbols[currency] || currency;
}

function getDocumentTypeName(business: Business, docType: string): string {
  if (business.businessType === 'OSEK_MURSHE' && docType === 'INVOICE') {
    return 'חשבונית מס';
  }
  return DOCUMENT_TYPE_NAMES[docType] || docType;
}

function generateHtml(document: DocumentWithRelations, business: Business): string {
  const docTypeName = getDocumentTypeName(business, document.documentType);
  const isOsekPatur = business.businessType === 'OSEK_PATUR';
  const currencySymbol = getCurrencySymbol(document.currency);
  const isForeignCurrency = document.currency !== 'ILS' && document.exchangeRate;
  const rate = document.exchangeRate ? intToRate(document.exchangeRate) : 1;

  // For foreign currency: show original + ILS in items table
  const itemsHtml = document.items.map((item, index) => {
    const qty = item.quantity / 100;
    const price = item.unitPrice / 100;
    const discount = item.discountPercent / 100;
    const lineTotal = item.lineTotal / 100;
    const ilsLineTotal = isForeignCurrency ? (lineTotal * rate).toFixed(2) : null;

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.description}</td>
        <td>${qty}</td>
        <td>${currencySymbol}${price.toFixed(2)}</td>
        <td>${discount > 0 ? discount.toFixed(1) + '%' : '-'}</td>
        <td>${isForeignCurrency
          ? `₪${ilsLineTotal} <span style="font-size:11px;color:#999">(${currencySymbol}${lineTotal.toFixed(2)})</span>`
          : `₪${lineTotal.toFixed(2)}`
        }</td>
      </tr>
    `;
  }).join('');

  // Exchange rate info
  let exchangeRateHtml = '';
  if (isForeignCurrency) {
    const currName = CURRENCY_NAMES[document.currency] || document.currency;
    exchangeRateHtml = `
    <div class="exchange-info">
      <strong>שער חליפין:</strong> 1 ${currName} = ₪${rate.toFixed(4)}
    </div>`;
  }

  // Totals in ILS
  const displaySubtotal = isForeignCurrency ? Math.round(document.subtotal * rate) : document.subtotal;
  const displayVatAmount = isForeignCurrency ? Math.round(document.vatAmount * rate) : document.vatAmount;
  const displayTotal = isForeignCurrency ? (document.ilsTotal || Math.round(document.total * rate)) : document.total;

  // Withholding tax info (always in ILS)
  let withholdingHtml = '';
  if (document.withholdingTaxPercent && document.withholdingTaxAmount) {
    const pct = document.withholdingTaxPercent / 100;
    const displayWithholding = isForeignCurrency ? Math.round(document.withholdingTaxAmount * rate) : document.withholdingTaxAmount;
    const displayNetAfterTax = isForeignCurrency
      ? Math.round((document.netAfterTax || (document.total - document.withholdingTaxAmount)) * rate)
      : (document.netAfterTax || (document.total - document.withholdingTaxAmount));
    withholdingHtml = `
      <div class="totals-row">
        <span>ניכוי מס במקור (${pct.toFixed(1)}%):</span>
        <span>-${formatCurrency(displayWithholding, 'ILS')}</span>
      </div>
      <div class="totals-row total">
        <span>לתשלום בפועל:</span>
        <span>${formatCurrency(displayNetAfterTax, 'ILS')}</span>
      </div>`;
  }

  // Payer bank info
  let payerBankHtml = '';
  if (document.payerBankName) {
    payerBankHtml = `
    <div class="payment-info">
      <strong>פרטי חשבון בנק משלם:</strong>
      ${document.payerBankName}
      ${document.payerBankBranch ? ` | סניף: ${document.payerBankBranch}` : ''}
      ${document.payerBankAccount ? ` | חשבון: ${document.payerBankAccount}` : ''}
    </div>`;
  }

  // Generation date footer
  const generatedAt = new Date().toLocaleString('he-IL', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Heebo', Arial, sans-serif;
      direction: rtl;
      color: #333;
      font-size: 14px;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 30px; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid ${business.primaryColor};
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .business-info h1 {
      font-size: 24px;
      color: ${business.primaryColor};
      margin-bottom: 5px;
    }
    .business-info p { font-size: 12px; color: #666; }

    .doc-type-box {
      background: ${business.primaryColor};
      color: white;
      padding: 10px 25px;
      border-radius: 8px;
      text-align: center;
    }
    .doc-type-box h2 { font-size: 20px; margin-bottom: 3px; }
    .doc-type-box p { font-size: 13px; }

    ${business.logoUrl ? `.logo { max-width: 120px; max-height: 60px; margin-bottom: 10px; }` : ''}

    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
    }
    .party-box {
      flex: 1;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .party-box:first-child { margin-left: 15px; }
    .party-box h3 {
      font-size: 14px;
      color: ${business.primaryColor};
      margin-bottom: 8px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .party-box p { font-size: 12px; margin: 3px 0; }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table th {
      background: ${business.primaryColor};
      color: white;
      padding: 10px 12px;
      text-align: right;
      font-size: 13px;
    }
    .items-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    .items-table tr:nth-child(even) { background: #f8f9fa; }

    .totals {
      margin-right: auto;
      width: 280px;
      margin-bottom: 25px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .totals-row.total {
      font-size: 18px;
      font-weight: 700;
      color: ${business.primaryColor};
      border-top: 2px solid ${business.primaryColor};
      padding-top: 10px;
      margin-top: 5px;
    }

    .payment-info {
      background: #f0f9ff;
      padding: 12px 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      font-size: 13px;
    }

    .exchange-info {
      background: #f3f0ff;
      padding: 12px 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      font-size: 13px;
    }

    .notes {
      padding: 10px 15px;
      background: #fff9e6;
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 15px;
    }

    .legal {
      text-align: center;
      font-size: 11px;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 15px;
      margin-top: 20px;
    }
    .legal .warning {
      color: #e74c3c;
      font-weight: 500;
    }

    .bank-info {
      background: #f8f9fa;
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 15px;
    }

    .doc-footer {
      text-align: center;
      font-size: 9px;
      color: #bbb;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #f0f0f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="business-info">
        ${business.logoUrl ? `<img src="${process.env.APP_URL}${business.logoUrl}" class="logo" alt="logo" />` : ''}
        <h1>${business.name}</h1>
        <p>ח.פ./ת.ז.: ${business.taxId}</p>
        ${business.vatNumber ? `<p>מספר עוסק מורשה: ${business.vatNumber}</p>` : ''}
        ${business.address ? `<p>${business.address}${business.city ? ', ' + business.city : ''}</p>` : ''}
        ${business.phone ? `<p>טל: ${business.phone}</p>` : ''}
        ${business.email ? `<p>${business.email}</p>` : ''}
      </div>
      <div class="doc-type-box">
        <h2>${docTypeName}</h2>
        <p>מספר: ${document.documentNumber}</p>
        <p>תאריך: ${new Date(document.issueDate).toLocaleDateString('he-IL')}</p>
        ${document.dueDate ? `<p>לתשלום עד: ${new Date(document.dueDate).toLocaleDateString('he-IL')}</p>` : ''}
      </div>
    </div>

    ${document.customer ? `
    <div class="parties">
      <div class="party-box">
        <h3>פרטי הנמען</h3>
        <p><strong>${document.customer.name}</strong></p>
        ${document.customer.taxId ? `<p>ח.פ./ת.ז.: ${document.customer.taxId}</p>` : ''}
        ${document.customer.address ? `<p>${document.customer.address}${document.customer.city ? ', ' + document.customer.city : ''}</p>` : ''}
        ${document.customer.phone ? `<p>טל: ${document.customer.phone}</p>` : ''}
      </div>
    </div>` : ''}

    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>תיאור</th>
          <th>כמות</th>
          <th>מחיר יחידה</th>
          <th>הנחה</th>
          <th>סה"כ</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>סכום ביניים:</span>
        <span>${formatCurrency(displaySubtotal, 'ILS')}</span>
      </div>
      ${(!isOsekPatur && !document.noVat) ? `
      <div class="totals-row">
        <span>מע"מ (${document.vatRate}%):</span>
        <span>${formatCurrency(displayVatAmount, 'ILS')}</span>
      </div>` : ''}
      <div class="totals-row total">
        <span>סה"כ לתשלום:</span>
        <span>${formatCurrency(displayTotal, 'ILS')}</span>
      </div>
      ${isForeignCurrency ? `
      <div class="totals-row" style="font-size: 11px; color: #999;">
        <span>סכום מקורי:</span>
        <span>${formatCurrency(document.total, document.currency)}</span>
      </div>` : ''}
      ${withholdingHtml}
    </div>

    ${exchangeRateHtml}

    ${document.paymentMethod ? `
    <div class="payment-info">
      <strong>אמצעי תשלום:</strong> ${PAYMENT_METHOD_NAMES[document.paymentMethod] || document.paymentMethod}
      ${document.paymentReference ? ` | <strong>אסמכתא:</strong> ${document.paymentReference}` : ''}
    </div>` : ''}

    ${payerBankHtml}

    ${business.bankName ? `
    <div class="bank-info">
      <strong>פרטי חשבון בנק:</strong> ${business.bankName} | סניף: ${business.bankBranch || '-'} | חשבון: ${business.bankAccount || '-'}
    </div>` : ''}

    ${document.notes ? `
    <div class="notes">
      <strong>הערות:</strong> ${document.notes}
    </div>` : ''}

    ${document.allocationStatus === 'APPROVED' && document.allocationNumber ? `
    <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 12px 15px; margin-bottom: 15px; text-align: center;">
      <strong style="font-size: 16px; color: #2e7d32;">מספר הקצאה: ${document.allocationNumber}</strong>
    </div>` : ''}

    ${document.allocationStatus === 'FAILED' ? `
    <div style="background: #ffebee; border: 2px solid #e74c3c; border-radius: 8px; padding: 12px 15px; margin-bottom: 15px; text-align: center;">
      <strong style="font-size: 15px; color: #c62828;">⚠ אין לנכות מס תשומות בגין חשבונית זו</strong>
    </div>` : ''}

    <div class="legal">
      ${isOsekPatur ? '<p class="warning">אינני רשום כעוסק מורשה, העסקה פטורה ממע"מ</p>' : ''}
      ${document.noVat && !isOsekPatur ? '<p class="warning">מסמך ללא מע"מ</p>' : ''}
      ${document.documentType === 'CREDIT_NOTE' && document.originalDocumentId ?
        `<p>חשבונית זיכוי למסמך מקורי מספר: ${document.originalDocumentId}</p>` : ''}
      <p>מסמך זה הופק באמצעות מערכת EladInvoice</p>
    </div>

    <div class="doc-footer">
      מסמך זה הופק בתאריך ${generatedAt}
    </div>
  </div>
</body>
</html>`;
}

export async function generatePdf(
  document: DocumentWithRelations,
  business: Business,
): Promise<string> {
  const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'uploads');
  const year = new Date(document.issueDate).getFullYear();
  const dir = path.join(storagePath, business.id, String(year));
  fs.mkdirSync(dir, { recursive: true });

  const typePrefix = document.documentType.toLowerCase().replace('_', '-');
  const filename = `${typePrefix}-${document.documentNumber}.html`;
  const filepath = path.join(dir, filename);

  const html = generateHtml(document, business);

  // Save as HTML (Puppeteer PDF generation can be added when puppeteer is available)
  fs.writeFileSync(filepath, html, 'utf8');

  const pdfUrl = `/uploads/${business.id}/${year}/${filename}`;
  return pdfUrl;
}

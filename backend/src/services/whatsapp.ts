import { Business, Document } from '@prisma/client';
import { formatCurrency } from '../utils/tax.utils';

const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  INVOICE: 'חשבונית',
  RECEIPT: 'קבלה',
  RECEIPT_INVOICE: 'חשבונית מס קבלה',
  CREDIT_NOTE: 'חשבונית זיכוי',
  DELIVERY_NOTE: 'תעודת משלוח',
};

function formatPhone(phone: string): string {
  let clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('0')) {
    clean = '972' + clean.slice(1);
  }
  if (clean.startsWith('+')) {
    clean = clean.slice(1);
  }
  return clean;
}

export async function sendWhatsApp(
  document: Document,
  business: Business,
  phone: string,
): Promise<{ type: 'api' | 'link'; url?: string }> {
  const provider = process.env.WHATSAPP_PROVIDER || 'none';
  const docTypeName = DOCUMENT_TYPE_NAMES[document.documentType] || document.documentType;
  const formattedPhone = formatPhone(phone);

  const message = `שלום, מצורפ/ת ${docTypeName} מספר ${document.documentNumber} מ${business.name} בסך ${formatCurrency(document.total, document.currency)}.${document.pdfUrl ? `\nקישור למסמך: ${process.env.APP_URL}${document.pdfUrl}` : ''}`;

  if (provider === 'twilio' && process.env.WHATSAPP_API_KEY) {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.WHATSAPP_API_KEY}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(process.env.WHATSAPP_API_KEY + ':' + process.env.WHATSAPP_PHONE_ID).toString('base64')}`,
          },
          body: new URLSearchParams({
            From: `whatsapp:+${process.env.WHATSAPP_PHONE_ID}`,
            To: `whatsapp:+${formattedPhone}`,
            Body: message,
          }),
        },
      );

      if (response.ok) {
        return { type: 'api' };
      }
    } catch (error) {
      console.error('Twilio WhatsApp error:', error);
    }
  }

  if (provider === 'whapi' && process.env.WHATSAPP_API_KEY) {
    try {
      const response = await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}`,
        },
        body: JSON.stringify({
          to: formattedPhone,
          body: message,
        }),
      });

      if (response.ok) {
        return { type: 'api' };
      }
    } catch (error) {
      console.error('Whapi WhatsApp error:', error);
    }
  }

  // Fallback: wa.me deep link
  const encodedMessage = encodeURIComponent(message);
  const waUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

  return { type: 'link', url: waUrl };
}

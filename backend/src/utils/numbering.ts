import { PrismaClient, DocumentType } from '@prisma/client';

/**
 * Get the next sequential document number for a business and document type.
 * Uses a transaction to ensure atomicity and prevent gaps.
 */
export async function getNextDocumentNumber(
  prisma: PrismaClient,
  businessId: string,
  documentType: DocumentType,
): Promise<number> {
  const fieldMap: Record<DocumentType, string> = {
    INVOICE: 'nextInvoiceNumber',
    RECEIPT: 'nextReceiptNumber',
    RECEIPT_INVOICE: 'nextReceiptInvoiceNumber',
    CREDIT_NOTE: 'nextCreditNoteNumber',
    DELIVERY_NOTE: 'nextDeliveryNoteNumber',
  };

  const field = fieldMap[documentType];

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new Error('Business not found');
    }

    const currentNumber = (business as Record<string, unknown>)[field] as number;

    await tx.business.update({
      where: { id: businessId },
      data: { [field]: currentNumber + 1 },
    });

    return currentNumber;
  });

  return result;
}

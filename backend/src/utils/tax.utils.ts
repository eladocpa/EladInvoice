/**
 * Israeli tax calculation utilities.
 * All amounts are in agorot (integer cents) to avoid floating point issues.
 */

const VAT_RATE = parseInt(process.env.VAT_RATE || '18', 10);

/**
 * Round half up — standard Israeli tax rounding.
 * Operates on agorot values but rounds to nearest agora.
 */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Calculate VAT amount from a net amount (exclusive of VAT).
 */
export function calculateVat(netAmountAgorot: number, vatRate: number = VAT_RATE): number {
  return roundHalfUp(netAmountAgorot * vatRate / 100);
}

/**
 * Calculate net amount from a gross amount (inclusive of VAT).
 */
export function extractNetFromGross(grossAmountAgorot: number, vatRate: number = VAT_RATE): number {
  return roundHalfUp(grossAmountAgorot * 100 / (100 + vatRate));
}

/**
 * Calculate line total for a document item.
 * quantity is stored as quantity * 100 (e.g., 1 item = 100).
 * unitPrice is in agorot.
 * discountPercent is stored as percent * 100 (e.g., 10% = 1000).
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0,
): number {
  const subtotal = roundHalfUp((quantity * unitPrice) / 100);
  if (discountPercent > 0) {
    const discount = roundHalfUp(subtotal * discountPercent / 10000);
    return subtotal - discount;
  }
  return subtotal;
}

/**
 * Calculate document totals.
 */
export function calculateDocumentTotals(
  items: Array<{ quantity: number; unitPrice: number; discountPercent: number }>,
  isOsekPatur: boolean,
  vatRate: number = VAT_RATE,
): { subtotal: number; vatAmount: number; total: number } {
  const subtotal = items.reduce(
    (sum, item) => sum + calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
    0,
  );

  const vatAmount = isOsekPatur ? 0 : calculateVat(subtotal, vatRate);
  const total = subtotal + vatAmount;

  return { subtotal, vatAmount, total };
}

export function getVatRate(): number {
  return VAT_RATE;
}

export function getOsekPaturThreshold(): number {
  return parseInt(process.env.OSEK_PATUR_THRESHOLD || '120000', 10);
}

/**
 * Format agorot to shekel display string.
 */
export function formatCurrency(agorot: number, currency: string = 'ILS'): string {
  const amount = agorot / 100;
  const symbols: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

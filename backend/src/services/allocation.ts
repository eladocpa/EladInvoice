import { Business, Document, Customer } from '@prisma/client';
import { prisma } from '../utils/prisma';

const API_URL = process.env.CHAVONIT_ISRAEL_API_URL || 'https://ita-api.taxes.gov.il/shaam/tsandroid/invoices';
const THRESHOLD = parseInt(process.env.CHAVONIT_ISRAEL_THRESHOLD || '10000', 10); // in shekels
const API_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 2;

export interface AllocationResult {
  required: boolean;
  status: 'NOT_REQUIRED' | 'APPROVED' | 'FAILED' | 'SKIPPED';
  allocationNumber?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: unknown;
}

/**
 * Check if allocation number is required for this document.
 * All 4 conditions must be met:
 * 1. Business is osek murshe
 * 2. Subtotal (before VAT) exceeds threshold
 * 3. Invoice includes VAT (vatRate > 0)
 * 4. Customer is osek murshe (has vatNumber/taxId)
 */
export function isAllocationRequired(
  business: Business,
  document: { subtotal: number; vatRate: number; documentType: string },
  customer: Customer | null,
): boolean {
  // Only for osek murshe
  if (business.businessType !== 'OSEK_MURSHE') return false;

  // Only for invoices and receipt-invoices (documents with VAT)
  if (!['INVOICE', 'RECEIPT_INVOICE'].includes(document.documentType)) return false;

  // Must include VAT
  if (document.vatRate <= 0) return false;

  // Subtotal must exceed threshold (convert agorot to shekels)
  const subtotalShekels = document.subtotal / 100;
  if (subtotalShekels <= THRESHOLD) return false;

  // Customer must be an osek murshe (identified by having a taxId)
  if (!customer?.taxId) return false;

  return true;
}

/**
 * Get the current allocation threshold in shekels.
 */
export function getAllocationThreshold(): number {
  return THRESHOLD;
}

/**
 * Check if business has chavonit israel credentials configured.
 */
export function hasAllocationCredentials(business: Business): boolean {
  return !!(business.chavonitClientId && business.chavonitClientSecret);
}

/**
 * Get OAuth2 token from רשות המסים.
 */
async function getOAuthToken(clientId: string, clientSecret: string): Promise<string> {
  const tokenUrl = 'https://ita-api.taxes.gov.il/shaam/tsandroid/oauth/token';

  const response = await fetchWithTimeout(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  }, API_TIMEOUT);

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Fetch with timeout support.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Request allocation number from רשות המסים API.
 * Retries up to MAX_RETRIES times on failure.
 */
export async function requestAllocationNumber(
  business: Business,
  document: Document,
  customer: Customer,
): Promise<AllocationResult> {
  if (!business.chavonitClientId || !business.chavonitClientSecret) {
    return {
      required: true,
      status: 'FAILED',
      errorMessage: 'יש להגדיר חיבור לחשבונית ישראל בהגדרות לפני הפקת מסמך זה',
    };
  }

  const payload = {
    taxId: business.vatNumber || business.taxId,
    invoiceReferenceNumber: String(document.documentNumber),
    totalVatIncluded: String(document.total / 100), // convert agorot to shekels
    invoiceDate: new Date(document.issueDate).toISOString().split('T')[0],
    customerVatNumber: customer.taxId,
  };

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      // Get OAuth token
      const token = await getOAuthToken(business.chavonitClientId, business.chavonitClientSecret);

      // Request allocation number
      const response = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }, API_TIMEOUT);

      const rawResponse = await response.json();

      // Save raw response
      await prisma.document.update({
        where: { id: document.id },
        data: {
          allocationResponseRaw: rawResponse as object,
          allocationRequestedAt: new Date(),
        },
      });

      if (response.ok && rawResponse.allocationNumber) {
        const allocationNumber = String(rawResponse.allocationNumber);

        await prisma.document.update({
          where: { id: document.id },
          data: {
            allocationNumber,
            allocationStatus: 'APPROVED',
          },
        });

        return {
          required: true,
          status: 'APPROVED',
          allocationNumber,
          rawResponse,
        };
      }

      // API returned an error/rejection
      if (attempt > MAX_RETRIES) {
        await prisma.document.update({
          where: { id: document.id },
          data: { allocationStatus: 'PENDING' },
        });

        return {
          required: true,
          status: 'FAILED',
          errorCode: rawResponse.errorCode || 'UNKNOWN',
          errorMessage: rawResponse.errorMessage || rawResponse.message || 'רשות המסים דחתה את הבקשה',
          rawResponse,
        };
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    } catch (error) {
      if (attempt > MAX_RETRIES) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errMsg.includes('abort');

        await prisma.document.update({
          where: { id: document.id },
          data: {
            allocationStatus: 'PENDING',
            allocationRequestedAt: new Date(),
          },
        });

        return {
          required: true,
          status: 'FAILED',
          errorMessage: isTimeout
            ? 'רשות המסים לא מגיבה — נסה שוב מאוחר יותר'
            : `שגיאה בתקשורת עם רשות המסים: ${errMsg}`,
        };
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  // Should not reach here
  return { required: true, status: 'FAILED', errorMessage: 'שגיאה לא צפויה' };
}

/**
 * Test connection to רשות המסים API.
 */
export async function testAllocationConnection(
  clientId: string,
  clientSecret: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getOAuthToken(clientId, clientSecret);
    if (token) {
      return { success: true, message: 'החיבור תקין — המערכת מוכנה להפקת מספרי הקצאה' };
    }
    return { success: false, message: 'החיבור נכשל — בדוק את ה-Client ID וה-Secret' };
  } catch {
    return { success: false, message: 'החיבור נכשל — בדוק את ה-Client ID וה-Secret' };
  }
}

/**
 * Mark document allocation as FAILED (user chose to continue without allocation).
 */
export async function markAllocationFailed(documentId: string): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: { allocationStatus: 'FAILED' },
  });
}

/**
 * Mark document allocation as SKIPPED.
 */
export async function markAllocationSkipped(documentId: string): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: { allocationStatus: 'SKIPPED' },
  });
}

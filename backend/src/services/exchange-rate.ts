/**
 * Exchange rate service - fetches representative rates from Bank of Israel
 * and crypto rates from public APIs.
 */

interface ExchangeRateCache {
  rate: number; // rate as float (e.g., 3.65)
  fetchedAt: number;
}

const cache: Record<string, ExchangeRateCache> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get Bank of Israel representative exchange rate for USD or EUR.
 * Uses the BOI PublicApi endpoint.
 * Returns rate as float (e.g., 3.119 for USD/ILS).
 */
async function fetchBoiRate(currency: 'USD' | 'EUR'): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://boi.org.il/PublicApi/GetExchangeRates?asOf=${today}&currencyCode=${currency}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`BOI API error: ${response.status}`);
  }

  const data: any = await response.json();

  // The API returns an array of exchange rate objects
  if (Array.isArray(data) && data.length > 0) {
    const rateObj = data[0];
    if (typeof rateObj.currentExchangeRate === 'number') {
      return rateObj.currentExchangeRate;
    }
    // Try alternate field names
    if (typeof rateObj.rate === 'number') {
      return rateObj.rate;
    }
    if (typeof rateObj.value === 'number') {
      return rateObj.value;
    }
  }

  // If the response is a single object
  if (data && typeof data.currentExchangeRate === 'number') {
    return data.currentExchangeRate;
  }

  throw new Error('Could not parse BOI exchange rate response');
}

/**
 * Fetch crypto rate in ILS.
 * First tries CoinGecko, falls back to calculating via USD rate.
 */
async function fetchCryptoRate(crypto: 'BTC' | 'ETH' | 'USDT' | 'USDC'): Promise<number> {
  const coinIds: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    USDT: 'tether',
    USDC: 'usd-coin',
  };

  const coinId = coinIds[crypto];

  // Try CoinGecko with ILS directly
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=ils`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data: any = await response.json();
      const rate = data?.[coinId]?.ils;
      if (typeof rate === 'number') {
        return rate;
      }
    }
  } catch {
    // Fall through to USD fallback
  }

  // Fallback: get USD price and multiply by USD/ILS rate
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data: any = await response.json();
      const usdRate = data?.[coinId]?.usd;
      if (typeof usdRate === 'number') {
        const usdToIls = await fetchBoiRate('USD');
        return usdRate * usdToIls;
      }
    }
  } catch {
    // Fall through
  }

  throw new Error(`Could not fetch rate for ${crypto}`);
}

/**
 * Get exchange rate to ILS for the given currency.
 * Returns rate as float (e.g., 3.65 means 1 USD = 3.65 ILS).
 * Uses 30-minute cache to avoid excessive API calls.
 */
export async function getExchangeRate(currency: string): Promise<number> {
  if (currency === 'ILS') return 1;

  // Check cache
  const cached = cache[currency];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.rate;
  }

  let rate: number;

  if (currency === 'USD' || currency === 'EUR') {
    rate = await fetchBoiRate(currency);
  } else if (['BTC', 'ETH', 'USDT', 'USDC'].includes(currency)) {
    rate = await fetchCryptoRate(currency as 'BTC' | 'ETH' | 'USDT' | 'USDC');
  } else {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  cache[currency] = { rate, fetchedAt: Date.now() };
  return rate;
}

/**
 * Convert exchange rate float to stored integer (rate * 10000).
 * e.g., 3.6512 -> 36512
 */
export function rateToInt(rate: number): number {
  return Math.round(rate * 10000);
}

/**
 * Convert stored integer back to float.
 */
export function intToRate(rateInt: number): number {
  return rateInt / 10000;
}

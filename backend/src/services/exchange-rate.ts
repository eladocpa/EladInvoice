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
 * Returns rate as float (e.g., 3.65 for USD/ILS).
 */
async function fetchBoiRate(currency: 'USD' | 'EUR'): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  // Try last 7 days to handle weekends/holidays
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const url = `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI/EXR/1.0/?startperiod=${startDate}&endperiod=${today}&c[CURRENCY]=${currency}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`BOI API error: ${response.status}`);
  }

  const data: any = await response.json();
  // Navigate the SDMX JSON structure to get the latest rate
  const series = data?.data?.dataSets?.[0]?.series;
  if (series) {
    const seriesKey = Object.keys(series)[0];
    const observations = series[seriesKey]?.observations;
    if (observations) {
      const keys = Object.keys(observations).sort((a, b) => Number(b) - Number(a));
      if (keys.length > 0) {
        return parseFloat(observations[keys[0]][0]);
      }
    }
  }

  throw new Error('Could not parse BOI exchange rate response');
}

/**
 * Fetch crypto rate in ILS from CoinGecko free API.
 */
async function fetchCryptoRate(crypto: 'BTC' | 'ETH' | 'USDT' | 'USDC'): Promise<number> {
  const coinIds: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    USDT: 'tether',
    USDC: 'usd-coin',
  };

  const coinId = coinIds[crypto];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=ils`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data: any = await response.json();
  const rate = data?.[coinId]?.ils;
  if (typeof rate !== 'number') {
    throw new Error('Could not parse CoinGecko response');
  }

  return rate;
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

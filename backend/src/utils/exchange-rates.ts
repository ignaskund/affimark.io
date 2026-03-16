/**
 * Static exchange rates — ECB reference rates, updated 2026-03-16.
 *
 * These are used as a best-effort fallback for currency conversion across the
 * affiliate data pipeline (Awin, Tradedoubler, price normalization). They are
 * intentionally static: Cloudflare Workers have no persistent state at request
 * time, and fetching live ECB rates on every request would add 200-400 ms of
 * latency. The exchange-rate-cron worker (when implemented) should update a KV
 * entry with fresh rates; callers can layer on top of this module.
 *
 * All rates expressed as: 1 EUR = N <currency>
 */

export const EUR_RATES: Record<string, number> = {
  EUR: 1.0,
  USD: 1.09,
  GBP: 0.855,
  CHF: 0.955,
  SEK: 11.22,
  NOK: 11.74,
  DKK: 7.462,
  PLN: 4.25,
  CZK: 25.12,
  HUF: 392.0,
  RON: 4.97,
  BGN: 1.956,   // Fixed peg to EUR
  HRK: 7.535,
  JPY: 161.5,
  CAD: 1.495,
  AUD: 1.695,
  NZD: 1.85,
  SGD: 1.46,
  INR: 90.8,
  BRL: 6.15,
};

/**
 * Convert an amount from any supported currency to EUR.
 * Returns the original amount unchanged if the currency is unrecognised.
 */
export function toEUR(amount: number, fromCurrency: string): number {
  if (!amount || !isFinite(amount)) return 0;
  const currency = fromCurrency?.toUpperCase();
  if (!currency || currency === 'EUR') return amount;
  const rate = EUR_RATES[currency];
  if (!rate) {
    console.warn(`[exchange-rates] Unknown currency "${fromCurrency}", returning amount as-is`);
    return amount;
  }
  return amount / rate;
}

/**
 * Convert an amount from EUR to any supported currency.
 * Returns the original amount unchanged if the currency is unrecognised.
 */
export function fromEUR(amount: number, toCurrency: string): number {
  if (!amount || !isFinite(amount)) return 0;
  const currency = toCurrency?.toUpperCase();
  if (!currency || currency === 'EUR') return amount;
  const rate = EUR_RATES[currency];
  if (!rate) {
    console.warn(`[exchange-rates] Unknown currency "${toCurrency}", returning amount as-is`);
    return amount;
  }
  return amount * rate;
}

/**
 * Return the exchange rate for a given currency against EUR.
 * 1 EUR = <rate> <currency>.
 */
export function getRate(currency: string): number {
  return EUR_RATES[currency?.toUpperCase()] ?? 1.0;
}

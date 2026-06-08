// connectors/stripe/format.ts — pure money/display helpers for the Stripe connector.
// No network, no DB — used by the action dry-run renderers (the approval-card text) and the
// audit summaries. Stripe amounts are integer minor units (cents for USD); these render them.

// Zero-decimal currencies have no minor unit — the integer amount IS the whole-currency value
// (Stripe charges 500 = ¥500, not ¥5.00). The common ones; unlisted currencies assume 2 decimals.
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv",
  "xaf", "xof", "xpf",
]);

/** Decimal places for a currency's minor unit (0 for zero-decimal currencies, else 2). */
export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2;
}

/**
 * Format an integer minor-unit amount as a human money string, e.g. (1999, "usd") → "$19.99",
 * (500, "jpy") → "¥500". Falls back to "<AMOUNT> <CURRENCY>" for currencies Intl can't symbol.
 */
export function formatAmount(minorUnits: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  const major = minorUnits / 10 ** decimals;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(major);
  } catch {
    // Unknown/invalid currency code — Intl throws; render the raw value rather than crash.
    return `${major.toFixed(decimals)} ${currency.toUpperCase()}`;
  }
}

/**
 * Convert a major-unit decimal amount (what an owner/drafter types, e.g. 19.99) into the integer
 * minor units Stripe wants (1999). Rounds to the currency's precision so floating-point dust
 * never reaches Stripe. Returns null for non-finite / negative input.
 */
export function toMinorUnits(major: number, currency: string): number | null {
  if (!Number.isFinite(major) || major < 0) return null;
  const decimals = currencyDecimals(currency);
  return Math.round(major * 10 ** decimals);
}

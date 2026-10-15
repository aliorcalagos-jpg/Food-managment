import { toLatinDigits } from "./arabic";

export type Currency = "NGN" | "USD";

/** Naira per US dollar. A fixed rate: it never changes on its own. */
export const DEFAULT_RATE = 1380;

/** Money is stored as whole kobo (1/100 naira), so sums never pick up floating-point drift. */
export const MAX_KOBO = 1e12;

const SYMBOL: Record<Currency, string> = { NGN: "₦", USD: "$" };

/**
 * Read an amount the way people type it, in either script, in major units (naira or dollars).
 * Accepts Arabic digits (٢٥٠٠), ٫ or . as the decimal mark, and , ، ٬ or spaces between thousands,
 * with an optional leading ₦ / $ / NGN / USD. A single "." or "," followed by one or two digits is a
 * decimal mark; groups of exactly three digits ("1,380" or "1.380.000") are thousands. Returns null for
 * anything else, including negatives, so a typo never becomes a silent wrong amount.
 */
export function parseAmount(input: string): number | null {
  let s = toLatinDigits(input)
    .replace(/[\s  ]/g, "")
    .replace(/^(?:₦|\$|NGN|USD)/i, "")
    .replace(/،/g, ","); // Arabic comma
  if (!s || !/^[\d.,]+$/.test(s)) return null;

  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;

  if (commas && dots) {
    // the mark that comes last is the decimal one
    const decimalIsDot = s.lastIndexOf(".") > s.lastIndexOf(",");
    s = decimalIsDot ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (commas) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else if (commas === 1 && /^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else return null;
  } else if (dots > 1) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else return null;
  }

  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n * 100 <= MAX_KOBO ? n : null;
}

/** An amount typed in `currency` as whole kobo. USD is converted once, here, at the fixed rate. */
export function toKobo(amount: number, currency: Currency, rate: number = DEFAULT_RATE): number {
  return Math.round(amount * (currency === "USD" ? rate : 1) * 100);
}

/** Convenience: parse what was typed and convert it, or null if it can't be read. */
export function parseMoney(input: string, currency: Currency, rate: number = DEFAULT_RATE): number | null {
  const amount = parseAmount(input);
  if (amount === null) return null;
  const kobo = toKobo(amount, currency, rate);
  return kobo <= MAX_KOBO ? kobo : null;
}

/** Kobo as major units of `currency` (naira, or dollars at the fixed rate). Not rounded. */
export function majorUnits(kobo: number, currency: Currency, rate: number = DEFAULT_RATE): number {
  return currency === "USD" ? kobo / 100 / rate : kobo / 100;
}

const NUMBER = {
  NGN: new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

/**
 * "₦2,500" / "₦2,500.50" / "$1.81". Digits are always 0-9 and the symbol comes first; in right-to-left text
 * the caller wraps this in a left-to-right isolate so it is never visually reordered.
 */
export function formatMoney(kobo: number, currency: Currency, rate: number = DEFAULT_RATE): string {
  const major = majorUnits(kobo, currency, rate);
  return `${SYMBOL[currency]}${NUMBER[currency].format(major)}`;
}

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** "₦12K", "₦1.2M", "$40": short amounts for chart labels. Whole units are kept as they are below 1,000. */
export function formatMoneyCompact(kobo: number, currency: Currency, rate: number = DEFAULT_RATE): string {
  const major = majorUnits(kobo, currency, rate);
  return `${SYMBOL[currency]}${Math.abs(major) < 1000 ? NUMBER.NGN.format(major) : COMPACT.format(major)}`;
}

/** What to type back into a price box for a stored amount: plain digits, no symbol or grouping. */
export function editableAmount(kobo: number, currency: Currency, rate: number = DEFAULT_RATE): string {
  return String(Number(majorUnits(kobo, currency, rate).toFixed(2)));
}

export const currencySymbol = (c: Currency) => SYMBOL[c];
export const isCurrency = (v: unknown): v is Currency => v === "NGN" || v === "USD";

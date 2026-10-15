import { toLatinDigits } from "./arabic";

/**
 * Parse "2", "0.5", "1/2", "1 1/2" (also Arabic digits like ٢ and decimal marks , ، ٫).
 * Unicode fractions like "½" are not supported. Returns null if invalid or <= 0.
 */
export function parseQuantity(input: string): number | null {
  const s = toLatinDigits(input).trim().replace(/[,،]/, ".");
  if (!s) return null;

  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, num, den] = mixed;
    return Number(den) === 0 ? null : positive(Number(whole) + Number(num) / Number(den));
  }
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? null : positive(Number(frac[1]) / Number(frac[2]));
  if (/^\d*\.?\d+$/.test(s)) return positive(Number(s));
  return null;
}

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : null);

const DENOMINATORS = [2, 3, 4, 6, 8];

/**
 * Display a quantity as a friendly fraction when it is (nearly) one, else a
 * decimal. Output always parses back via parseQuantity to the same value, so
 * editing a recipe doesn't erode quantities like 1/3.
 */
export function formatQuantity(n: number, decimals = 2): string {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  if (rest < 1e-9) return String(whole);
  for (const d of DENOMINATORS) {
    const k = Math.round(rest * d);
    if (k > 0 && k < d && Math.abs(rest - k / d) < 1e-6) {
      return whole > 0 ? `${whole} ${k}/${d}` : `${k}/${d}`;
    }
  }
  const f = 10 ** decimals;
  return String(Math.round(n * f) / f);
}

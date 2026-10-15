import { toLatinDigits } from "./arabic";
import { isUnitWord } from "./ingredients";

export type IngredientFields = { quantity: string; unit: string; name: string };

const VULGAR: Record<string, string> = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" };
const BULLET = /^\s*(?:[-•*·–—▪●]+|\d+[.)](?=\s))\s*/;
// "1 1/2", "1/2", "1.5" / "1,5" / "1،5", "2"; the quantity may touch its unit ("500g", "500جم")
const QUANTITY = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,،٫]\d+)?)/;
const LINKING = new Set(["of", "من"]);

/**
 * Splits one typed or pasted ingredient line ("2 كوب أرز", "500g flour", "1 1/2 cups of milk") into the
 * three form boxes. The quantity is kept as written (the form's own parser reads it); the unit is only taken
 * when it is a unit the app knows, so "2 bunch parsley" keeps "bunch parsley" as the name. A line with no
 * leading number gives an empty quantity rather than a guess.
 */
export function parseIngredientLine(line: string): IngredientFields {
  let s = toLatinDigits(line.replace(/[‎‏‪-‮]/g, ""))
    .replace(/(\d)\s*([½⅓⅔¼¾⅛⅜⅝⅞])/g, (_, d: string, f: string) => `${d} ${VULGAR[f]}`)
    .replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (f) => VULGAR[f])
    .replace(BULLET, "")
    .trim()
    .replace(/\s+/g, " ");

  const q = s.match(QUANTITY);
  if (!q) return { quantity: "", unit: "", name: s };
  const quantity = q[1];
  s = s.slice(quantity.length).trim();

  const words = s.split(" ").filter(Boolean);
  let unit = "";
  let used = 0;
  for (const n of [2, 1]) {
    const candidate = words.slice(0, n).join(" ");
    if (words.length >= n && isUnitWord(candidate)) {
      unit = candidate;
      used = n;
      break;
    }
  }
  let rest = words.slice(used);
  if (used > 0 && rest.length > 1 && LINKING.has(rest[0].toLowerCase())) rest = rest.slice(1);
  // "2 cups" alone: nothing is left for a name, so the word is the name, not a unit
  if (used > 0 && rest.length === 0) return { quantity, unit: "", name: unit };
  return { quantity, unit, name: rest.join(" ") };
}

/** One ingredient per non-blank line (bullets and numbering are removed by parseIngredientLine). */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.replace(BULLET, "").trim() !== "");
}

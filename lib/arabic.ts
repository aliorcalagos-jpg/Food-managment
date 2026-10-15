// Matching helpers for Arabic text. They are used to compare names and units (the key), never to
// rewrite what the person typed: lists keep the first spelling that was written.

const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g; // harakat, superscript alef, Quranic marks
const TATWEEL = /ـ/g;

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits to 0-9, and the Arabic decimal/thousands marks to . and nothing. */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
}

// Common spelling variants that are the same word in everyday use.
const SYNONYMS: Record<string, string> = {
  رز: "ارز", // colloquial رز = ارز (rice)
};

function normalizeWord(word: string): string {
  let w = word
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // alef with hamza above/below, madda, wasla -> alef
    .replace(/[\u0649\u06CC]/g, "\u064A") // alef maqsura, Persian yeh -> yeh
    .replace(/\u06A9/g, "\u0643") // Persian kaf -> kaf
    .replace(/\u0629/g, "\u0647"); // teh marbuta -> heh
  // drop the definite article, but never from a short word where "ال" is part of the word
  if (w.length > 3 && w.startsWith("ال")) w = w.slice(2);
  return SYNONYMS[w] ?? w;
}

/** Normalised form for comparing Arabic words: أرز / ارز / الأرز / رز all become ارز. */
export function normalizeArabic(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map(normalizeWord)
    .join(" ");
}

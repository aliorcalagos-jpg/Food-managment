import { describe, expect, it } from "vitest";
import { hasArabic, normalizeArabic, toLatinDigits } from "./arabic";

describe("normalizeArabic", () => {
  it("treats every common spelling of rice as one word", () => {
    for (const w of ["أرز", "ارز", "الأرز", "الارز", "رز", "الرز", "أَرُزّ"]) {
      expect(normalizeArabic(w)).toBe("ارز");
    }
  });
  it("unifies hamza/alef forms, yeh, kaf and teh marbuta", () => {
    expect(normalizeArabic("إبريق")).toBe("ابريق");
    expect(normalizeArabic("مستشفى")).toBe("مستشفي");
    expect(normalizeArabic("بامية")).toBe("باميه");
    expect(normalizeArabic("کتاب")).toBe("كتاب"); // Persian kaf
  });
  it("only strips the article from longer words", () => {
    expect(normalizeArabic("الم")).toBe("الم"); // a word that merely starts with ال
    expect(normalizeArabic("اللحم")).toBe("لحم");
  });
  it("works word by word and keeps spacing tidy", () => {
    expect(normalizeArabic("  دجاج   مع  الأرز ")).toBe("دجاج مع ارز");
  });
  it("leaves Latin text alone", () => {
    expect(normalizeArabic("Rice")).toBe("Rice");
  });
});

describe("toLatinDigits / hasArabic", () => {
  it("converts Arabic-Indic and Persian digits and decimal marks", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(toLatinDigits("٢٫٥")).toBe("2.5");
    expect(toLatinDigits("١٬٠٠٠")).toBe("1000");
    expect(toLatinDigits("12 cups")).toBe("12 cups");
  });
  it("detects Arabic script", () => {
    expect(hasArabic("رز")).toBe(true);
    expect(hasArabic("rice and رز")).toBe(true);
    expect(hasArabic("rice")).toBe(false);
  });
});

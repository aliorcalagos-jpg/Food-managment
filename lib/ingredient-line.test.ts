import { describe, expect, it } from "vitest";
import { isUnitWord } from "./ingredients";
import { parseIngredientLine as p, splitLines } from "./ingredient-line";

describe("parseIngredientLine", () => {
  it("splits the user's kind of Arabic lines", () => {
    expect(p("2 كوب أرز")).toEqual({ quantity: "2", unit: "كوب", name: "أرز" });
    expect(p("500 جم بطاطس")).toEqual({ quantity: "500", unit: "جم", name: "بطاطس" });
    expect(p("١ ١/٢ كيلو دجاج")).toEqual({ quantity: "1 1/2", unit: "كيلو", name: "دجاج" });
    expect(p("٣ حبة طماطم")).toEqual({ quantity: "3", unit: "حبة", name: "طماطم" });
    expect(p("3 طماطم")).toEqual({ quantity: "3", unit: "", name: "طماطم" });
    expect(p("2 ملعقة كبيرة زيت")).toEqual({ quantity: "2", unit: "ملعقة كبيرة", name: "زيت" });
    expect(p("2 كوب من الحليب")).toEqual({ quantity: "2", unit: "كوب", name: "الحليب" });
  });
  it("splits English lines, attached units and fractions", () => {
    expect(p("3 tomatoes")).toEqual({ quantity: "3", unit: "", name: "tomatoes" });
    expect(p("500g flour")).toEqual({ quantity: "500", unit: "g", name: "flour" });
    expect(p("500جم بطاطس")).toEqual({ quantity: "500", unit: "جم", name: "بطاطس" });
    expect(p("1/2 cup sugar")).toEqual({ quantity: "1/2", unit: "cup", name: "sugar" });
    expect(p("1 1/2 cups of milk")).toEqual({ quantity: "1 1/2", unit: "cups", name: "milk" });
    expect(p("1.5 kg. rice")).toEqual({ quantity: "1.5", unit: "kg.", name: "rice" });
    expect(p("1,5 كوب رز")).toEqual({ quantity: "1,5", unit: "كوب", name: "رز" });
    expect(p("½ cup oil")).toEqual({ quantity: "1/2", unit: "cup", name: "oil" });
    expect(p("1½ cup oil")).toEqual({ quantity: "1 1/2", unit: "cup", name: "oil" });
  });
  it("never invents anything", () => {
    expect(p("ملح")).toEqual({ quantity: "", unit: "", name: "ملح" });
    expect(p("2 bunch parsley")).toEqual({ quantity: "2", unit: "", name: "bunch parsley" });
    expect(p("2 cups")).toEqual({ quantity: "2", unit: "", name: "cups" });
    expect(p("   ")).toEqual({ quantity: "", unit: "", name: "" });
    expect(p("2 of")).toEqual({ quantity: "2", unit: "", name: "of" });
  });
  it("copes with bullets, numbering, odd spacing and direction marks", () => {
    expect(p("- 2 cups rice")).toEqual({ quantity: "2", unit: "cups", name: "rice" });
    expect(p("• ٢   كوب   أرز")).toEqual({ quantity: "2", unit: "كوب", name: "أرز" });
    expect(p("1. 2 cups rice")).toEqual({ quantity: "2", unit: "cups", name: "rice" });
    expect(p("1.5 cups rice").quantity).toBe("1.5"); // not numbering
    expect(p("‏2 كوب أرز")).toEqual({ quantity: "2", unit: "كوب", name: "أرز" });
  });
  it("does not treat object keys as units", () => {
    expect(isUnitWord("constructor")).toBe(false);
    expect(p("2 constructor").name).toBe("constructor");
  });
});

describe("splitLines", () => {
  it("gives one line per ingredient and drops blanks and bare bullets", () => {
    expect(splitLines("2 كوب أرز\r\n\n  - \n• 1 كيلو دجاج\n")).toEqual(["2 كوب أرز", "• 1 كيلو دجاج"]);
    expect(splitLines("")).toEqual([]);
  });
});

describe("isUnitWord", () => {
  it("knows English, Arabic and count words, and rejects the rest", () => {
    for (const w of ["kg", "Cups", "tbsp", "كوب", "ملعقة كبيرة", "حبة", "pcs"]) expect(isUnitWord(w), w).toBe(true);
    for (const w of ["", "bunch", "أرز", "milk"]) expect(isUnitWord(w), w).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { validateRecipe, type RecipeFormValues } from "./forms";

const ok: RecipeFormValues = {
  title: " Soup ",
  servings: "4",
  tags: "Dinner, dinner ,  Quick ,",
  sourceUrl: "",
  instructions: " Simmer. ",
  rows: [
    { name: "leek", quantity: "1 1/2", unit: "" },
    { name: "", quantity: "", unit: "" },
    { name: "stock", quantity: "0.5", unit: " l " },
  ],
};
const errors = (over: Partial<RecipeFormValues>) => {
  const r = validateRecipe({ ...ok, ...over });
  return r.ok ? null : r.errors;
};

describe("validateRecipe", () => {
  it("normalises a valid form and skips blank rows", () => {
    expect(validateRecipe(ok)).toEqual({
      ok: true,
      recipe: {
        title: "Soup", servings: 4, tags: ["dinner", "quick"], instructions: "Simmer.", sourceUrl: null,
        ingredients: [{ name: "leek", quantity: 1.5, unit: "" }, { name: "stock", quantity: 0.5, unit: "l" }],
      },
    });
  });

  it("requires a title but not ingredients: a dish can be saved by name first", () => {
    expect(errors({ title: "  " })).toEqual({ title: { key: "errTitleRequired" } });
    const r = validateRecipe({ ...ok, rows: [{ name: "", quantity: "", unit: "" }] });
    expect(r.ok && r.recipe.ingredients).toEqual([]);
  });

  it.each(["0", "2.5", "abc", "101", ""])("rejects servings %j", (s) => {
    expect(errors({ servings: s })?.servings).toBeDefined();
  });

  it("flags a half-filled or bad row instead of dropping it, with the details to show", () => {
    expect(errors({ rows: [{ name: "leek", quantity: "lots", unit: "" }] })?.ingredients).toEqual({ key: "errQty", params: { name: "leek" } });
    expect(errors({ rows: [{ name: "", quantity: "lots", unit: "" }] })?.ingredients).toEqual({ key: "errQtyRow", params: { n: 1 } });
    expect(errors({ rows: [{ name: "", quantity: "2", unit: "" }] })?.ingredients).toEqual({ key: "errRowName", params: { n: 1 } });
  });

  it("only accepts http(s) source links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.test", "not a url"]) {
      expect(errors({ sourceUrl: bad })?.sourceUrl).toEqual({ key: "errUrl" });
    }
    expect(errors({ sourceUrl: "https://example.com/r" })).toBeNull();
  });

  it("caps tags at 10", () => {
    expect(errors({ tags: "a,b,c,d,e,f,g,h,i,j,k" })?.tags).toEqual({ key: "errTagsMany" });
  });

  it("understands Arabic: digits, Arabic comma, and keeps the text exactly as typed", () => {
    const r = validateRecipe({
      title: " رز مع دجاج ",
      servings: "٤",
      tags: "غداء، سريع",
      sourceUrl: "",
      instructions: "",
      rows: [
        { name: "أرز", quantity: "٢", unit: "كوب" },
        { name: "دجاج", quantity: "١ ١/٢", unit: "كيلو" },
      ],
    });
    expect(r).toEqual({
      ok: true,
      recipe: {
        title: "رز مع دجاج", servings: 4, tags: ["غداء", "سريع"], instructions: "", sourceUrl: null,
        ingredients: [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1.5, unit: "كيلو" }],
      },
    });
  });
});

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
    const r = validateRecipe(ok);
    expect(r).toEqual({
      ok: true,
      recipe: {
        title: "Soup", servings: 4, tags: ["dinner", "quick"], instructions: "Simmer.", sourceUrl: null,
        ingredients: [{ name: "leek", quantity: 1.5, unit: "" }, { name: "stock", quantity: 0.5, unit: "l" }],
      },
    });
  });

  it("requires a title and at least one ingredient", () => {
    expect(errors({ title: "  ", rows: [{ name: "", quantity: "", unit: "" }] })).toEqual({
      title: "Title is required",
      ingredients: "Add at least one ingredient",
    });
  });

  it.each(["0", "2.5", "abc", "101", ""])("rejects servings %j", (s) => {
    expect(errors({ servings: s })?.servings).toBeDefined();
  });

  it("flags a bad quantity by name instead of dropping the row", () => {
    expect(errors({ rows: [{ name: "leek", quantity: "lots", unit: "" }] })?.ingredients).toMatch(/"leek"/);
    expect(errors({ rows: [{ name: "", quantity: "2", unit: "" }] })?.ingredients).toMatch(/needs an ingredient name/);
  });

  it("only accepts http(s) source links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.test", "not a url"]) {
      expect(errors({ sourceUrl: bad })?.sourceUrl).toBeDefined();
    }
    expect(errors({ sourceUrl: "https://example.com/r" })).toBeNull();
  });

  it("caps tags at 10", () => {
    expect(errors({ tags: "a,b,c,d,e,f,g,h,i,j,k" })?.tags).toBe("At most 10 tags");
  });
});

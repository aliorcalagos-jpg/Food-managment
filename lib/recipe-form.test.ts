import { describe, expect, it } from "vitest";
import { parseRecipeForm, parseTags } from "./validation";

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

const ok = {
  title: " Soup ",
  servings: "4",
  instructions: "",
  sourceUrl: "",
  tags: "Dinner, dinner ,  Quick ,",
  ing_name: ["leek", "", "stock"],
  ing_qty: ["1 1/2", "", "0.5"],
  ing_unit: ["", "", "l"],
};

describe("parseTags", () => {
  it("lowercases, trims, dedupes, drops empties", () => {
    expect(parseTags("Dinner, dinner ,  Quick ,")).toEqual(["dinner", "quick"]);
  });
});

describe("parseRecipeForm", () => {
  it("parses a valid form and skips blank ingredient rows", () => {
    const r = parseRecipeForm(form(ok));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.title).toBe("Soup");
      expect(r.data.sourceUrl).toBeNull();
      expect(r.data.tags).toEqual(["dinner", "quick"]);
      expect(r.data.ingredients).toEqual([
        { name: "leek", quantity: 1.5, unit: "" },
        { name: "stock", quantity: 0.5, unit: "l" },
      ]);
    }
  });

  it("rejects javascript: and other non-http source links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.test", "not a url"]) {
      const r = parseRecipeForm(form({ ...ok, sourceUrl: bad }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.sourceUrl).toBeDefined();
    }
    expect(parseRecipeForm(form({ ...ok, sourceUrl: "https://example.com/r" })).ok).toBe(true);
  });

  it("requires a title and at least one ingredient", () => {
    const r = parseRecipeForm(form({ ...ok, title: " ", ing_name: [""], ing_qty: [""], ing_unit: [""] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["ingredients", "title"]);
  });

  it("flags a bad quantity instead of silently dropping the row", () => {
    const r = parseRecipeForm(form({ ...ok, ing_qty: ["lots", "", "0.5"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.ingredients).toMatch(/leek/);
  });

  it("rejects non-integer or out-of-range servings", () => {
    for (const s of ["0", "2.5", "abc", "101"]) {
      expect(parseRecipeForm(form({ ...ok, servings: s })).ok).toBe(false);
    }
  });
});

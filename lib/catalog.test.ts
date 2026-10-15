import { describe, expect, it } from "vitest";
import { CATEGORIES, categorize } from "./categories";
import { CATALOG, catalogItemFor, GROUPS, searchCatalog } from "./catalog";
import { isUnitWord, normalizeName } from "./ingredients";

describe("catalog", () => {
  it("has both languages for every item, a real aisle and a known unit", () => {
    for (const i of CATALOG) {
      expect(i.en.trim(), i.en).not.toBe("");
      expect(i.ar.trim(), i.en).toMatch(/[؀-ۿ]/);
      expect(CATEGORIES as readonly string[], i.en).toContain(i.aisle);
      if (i.unit) expect(isUnitWord(i.unit), `${i.en} unit`).toBe(true);
    }
  });
  it("has no ingredient twice, in either language, even after spelling folding", () => {
    const seen = new Map<string, string>();
    for (const i of CATALOG) {
      for (const n of [i.en, i.ar]) {
        const k = normalizeName(n);
        expect(seen.get(k), `${n} repeats ${seen.get(k)}`).toBeUndefined();
        seen.set(k, i.en);
      }
    }
  });
  it("covers every group with plenty to choose from", () => {
    for (const g of GROUPS) expect(CATALOG.filter((i) => i.group === g).length, g).toBeGreaterThanOrEqual(7);
    expect(CATALOG.filter((i) => i.group === "vegetables").length).toBeGreaterThanOrEqual(40);
    expect(CATALOG.filter((i) => i.group === "chicken").length).toBeGreaterThanOrEqual(10);
    expect(CATALOG.filter((i) => i.group === "meat").length).toBeGreaterThanOrEqual(15);
  });
  it("puts every item in its own aisle on a shopping list, in either language", () => {
    for (const i of CATALOG) {
      expect(categorize(i.en), i.en).toBe(i.aisle);
      expect(categorize(i.ar), i.ar).toBe(i.aisle);
    }
  });
  it("finds an item from other spellings and plurals", () => {
    expect(catalogItemFor("رز")?.en).toBe("rice");
    expect(catalogItemFor("الأرز")?.en).toBe("rice");
    expect(catalogItemFor("Tomatoes")?.ar).toBe("طماطم");
    expect(catalogItemFor("something unusual")).toBeUndefined();
  });
});

describe("searchCatalog", () => {
  it("folds Arabic spelling: ارز, رز and أرز all find rice first", () => {
    for (const t of ["ارز", "رز", "أرز", "الأرز"]) expect(searchCatalog(t)[0].en, t).toBe("rice");
    expect(searchCatalog("ارز").map((i) => i.en)).toContain("basmati rice");
  });
  it("finds every chicken cut for دجاج, and nothing from other groups first", () => {
    const found = searchCatalog("دجاج");
    const cuts = CATALOG.filter((i) => i.group === "chicken" && i.ar.includes("دجاج"));
    expect(cuts.length).toBeGreaterThan(8);
    for (const c of cuts) expect(found.map((i) => i.en), c.en).toContain(c.en);
  });
  it("searches English too, ranks prefixes first, and ignores empty text", () => {
    expect(searchCatalog("chick")[0].group).toBe("chicken");
    expect(searchCatalog("tom")[0].en).toBe("tomato");
    expect(searchCatalog("  ")).toEqual([]);
    expect(searchCatalog("zzzz")).toEqual([]);
  });
  it("respects the limit", () => {
    expect(searchCatalog("a", 5)).toHaveLength(5);
  });
});

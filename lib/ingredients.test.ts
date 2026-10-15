import { describe, expect, it } from "vitest";
import { mergeIngredients, normalizeName, normalizeUnit, scaleIngredient } from "./ingredients";

describe("normalize", () => {
  it("normalizes unit aliases", () => {
    expect(normalizeUnit("Tablespoons")).toBe("tbsp");
    expect(normalizeUnit("lbs.")).toBe("lb");
  });
  it("singularizes names", () => {
    expect(normalizeName("Tomatoes")).toBe("tomato");
    expect(normalizeName("berries")).toBe("berry");
    expect(normalizeName("Eggs")).toBe("egg");
    expect(normalizeName("grass")).toBe("grass");
  });
});

describe("scaleIngredient", () => {
  it("scales by servings ratio", () => {
    expect(scaleIngredient({ name: "rice", quantity: 200, unit: "g" }, 2, 6).quantity).toBe(600);
  });
  it("rejects zero servings", () => {
    expect(() => scaleIngredient({ name: "x", quantity: 1, unit: "g" }, 0, 1)).toThrow();
  });
});

describe("mergeIngredients", () => {
  it("sums same name and unit", () => {
    expect(
      mergeIngredients([
        { name: "Egg", quantity: 2, unit: "" },
        { name: "eggs", quantity: 3, unit: "pcs" },
      ]),
    ).toEqual([{ name: "egg", quantity: 5, unit: "" }]);
  });

  it("converts within a unit family and promotes to larger unit", () => {
    expect(
      mergeIngredients([
        { name: "flour", quantity: 500, unit: "g" },
        { name: "flour", quantity: 0.75, unit: "kg" },
      ]),
    ).toEqual([{ name: "flour", quantity: 1.25, unit: "kg" }]);
  });

  it("keeps incompatible families separate", () => {
    const out = mergeIngredients([
      { name: "butter", quantity: 100, unit: "g" },
      { name: "butter", quantity: 2, unit: "tbsp" },
    ]);
    expect(out).toHaveLength(2);
  });

  it("only merges unknown units with the same unit", () => {
    const out = mergeIngredients([
      { name: "basil", quantity: 1, unit: "bunch" },
      { name: "basil", quantity: 2, unit: "bunch" },
      { name: "basil", quantity: 1, unit: "can" },
    ]);
    expect(out).toEqual([
      { name: "basil", quantity: 3, unit: "bunch" },
      { name: "basil", quantity: 1, unit: "can" },
    ]);
  });

  it("shows names as written, never the singularised matching key", () => {
    const names = mergeIngredients([
      { name: "Hummus", quantity: 1, unit: "cup" },
      { name: "Asparagus", quantity: 1, unit: "bunch" },
      { name: "chocolate cookies", quantity: 6, unit: "" },
    ]).map((i) => i.name);
    expect(names).toEqual(["asparagus", "chocolate cookies", "hummus"]);
  });

  it("keeps the unit when every entry uses the same one", () => {
    expect(
      mergeIngredients([
        { name: "milk", quantity: 2, unit: "cup" },
        { name: "milk", quantity: 1, unit: "cups" },
        { name: "olive oil", quantity: 3, unit: "tbsp" },
      ]),
    ).toEqual([
      { name: "milk", quantity: 3, unit: "cup" },
      { name: "olive oil", quantity: 3, unit: "tbsp" },
    ]);
  });

  it("converts mixed units to the largest present unit that gives at least 1", () => {
    expect(
      mergeIngredients([
        { name: "milk", quantity: 2, unit: "cup" },
        { name: "milk", quantity: 4, unit: "tbsp" },
      ]),
    ).toEqual([{ name: "milk", quantity: 2.25, unit: "cup" }]);
    // below 1 of the largest unit: fall back to the smaller one present
    expect(
      mergeIngredients([
        { name: "salt", quantity: 1, unit: "tsp" },
        { name: "salt", quantity: 0.25, unit: "cup" },
      ]),
    ).toEqual([{ name: "salt", quantity: 13, unit: "tsp" }]);
  });

  it("does not round away fractions", () => {
    const [out] = mergeIngredients([
      { name: "flour", quantity: 1 / 3, unit: "cup" },
      { name: "flour", quantity: 1 / 3, unit: "cup" },
    ]);
    expect(out.quantity).toBeCloseTo(2 / 3, 5);
  });
});

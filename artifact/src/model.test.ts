import { describe, expect, it } from "vitest";
import {
  addItem, addMeal, clearChecked, datesInRange, dropRecipe, generateList, removeItem, removeMeal,
  setMealServings, toList, toPlanDay, toRecipe, toggleItem, type PlanDay, type Recipe,
} from "./model";

const pasta: Recipe = {
  id: "pasta", title: "Pasta", servings: 4, tags: [], instructions: "", sourceUrl: null,
  ingredients: [
    { name: "Spaghetti", quantity: 400, unit: "g" },
    { name: "milk", quantity: 2, unit: "cup" },
    { name: "tomatoes", quantity: 3, unit: "" },
  ],
};
const bake: Recipe = {
  id: "bake", title: "Bake", servings: 2, tags: [], instructions: "", sourceUrl: null,
  ingredients: [{ name: "spaghetti", quantity: 1, unit: "kg" }],
};
const e = (id: string, recipeId: string, servings: number) => ({ id, mealType: "DINNER" as const, recipeId, servings });
const day = (date: string, ...entries: ReturnType<typeof e>[]): PlanDay => ({ date, entries });

describe("reading documents defensively", () => {
  it("fills defaults for missing or wrong-typed fields", () => {
    expect(toRecipe("r", { title: 5, servings: "x", tags: ["a", 1], ingredients: [null, { name: "x", quantity: "1" }] })).toEqual({
      id: "r", title: "Untitled", servings: 1, tags: ["a"], instructions: "", sourceUrl: null,
      ingredients: [{ name: "", quantity: 0, unit: "" }, { name: "x", quantity: 0, unit: "" }],
    });
    expect(toPlanDay("2026-10-12", {}).entries).toEqual([]);
    expect(toList("l", { items: [{ id: "i", name: "milk", checked: "yes" }] }).items[0]).toMatchObject({ checked: false, quantity: 1 });
  });
});

describe("meal plan edits", () => {
  it("adds to an empty day, edits servings, removes, and drops a recipe everywhere in the day", () => {
    let d = addMeal(undefined, "2026-10-12", e("a", "pasta", 4));
    d = addMeal(d, "2026-10-12", e("b", "bake", 2));
    expect(d.entries).toHaveLength(2);
    d = setMealServings(d, "a", 6);
    expect(d.entries[0].servings).toBe(6);
    expect(removeMeal(d, "a").entries.map((x) => x.id)).toEqual(["b"]);
    expect(dropRecipe(d, "pasta").entries.map((x) => x.id)).toEqual(["b"]);
  });
  it("does not mutate its input", () => {
    const d = day("2026-10-12", e("a", "pasta", 4));
    const frozen = JSON.stringify(d);
    removeMeal(d, "a"); setMealServings(d, "a", 9); dropRecipe(d, "pasta");
    expect(JSON.stringify(d)).toBe(frozen);
  });
});

describe("datesInRange", () => {
  it("is inclusive on both ends and empty for bad input", () => {
    expect(datesInRange("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(datesInRange("2026-10-12", "2026-10-12")).toEqual(["2026-10-12"]);
    expect(datesInRange("2026-10-13", "2026-10-12")).toEqual([]);
    expect(datesInRange("nope", "2026-10-12")).toEqual([]);
  });
});

describe("generateList", () => {
  const days = [
    day("2026-10-12", e("1", "pasta", 2)),
    day("2026-10-14", e("2", "pasta", 4)),
    day("2026-10-16", e("3", "bake", 2)),
    day("2026-10-19", e("4", "bake", 2)), // after the range
    day("2026-10-11", e("5", "bake", 2)), // before the range
  ];
  const input = { name: "Week", start: "2026-10-12", end: "2026-10-18" };

  it("scales, merges and categorises (same numbers as the Next app)", () => {
    const r = generateList(input, [pasta, bake], days);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.list.items.map(({ id, ...rest }) => ({ ...rest, id: typeof id }))).toEqual([
      { name: "milk", quantity: 3, unit: "cup", category: "Dairy & eggs", checked: false, id: "string" },
      { name: "spaghetti", quantity: 1.6, unit: "kg", category: "Pantry", checked: false, id: "string" },
      { name: "tomatoes", quantity: 4.5, unit: "", category: "Produce", checked: false, id: "string" },
    ]);
    expect(r.list).toMatchObject({ name: "Week", rangeStart: "2026-10-12", rangeEnd: "2026-10-18" });
  });

  it("includes both ends of the range", () => {
    const r = generateList({ ...input, start: "2026-10-16", end: "2026-10-19" }, [pasta, bake], days);
    expect(r.ok && r.list.items.find((i) => i.name === "spaghetti")?.quantity).toBe(2); // two bakes of 1 kg
  });

  it("explains why it cannot generate", () => {
    const err = (i: typeof input, d = days) => { const r = generateList(i, [pasta, bake], d); return r.ok ? "" : r.error; };
    expect(err({ ...input, start: "2030-01-01", end: "2030-01-07" })).toMatch(/No meals are planned/);
    expect(err({ ...input, end: "2026-10-01" })).toMatch(/on or after/);
    expect(err({ ...input, start: "bad" })).toMatch(/Pick a start/);
    expect(err({ ...input, start: "2026-01-01", end: "2026-12-31" })).toMatch(/at most 62/);
  });

  it("skips planned meals whose recipe no longer exists", () => {
    const r = generateList(input, [bake], [day("2026-10-12", e("1", "gone", 2), e("2", "bake", 2))]);
    expect(r.ok && r.list.items.map((i) => i.name)).toEqual(["spaghetti"]);
  });

  it("falls back to a dated name when none is given", () => {
    const r = generateList({ ...input, name: "  " }, [pasta, bake], days);
    expect(r.ok && r.list.name).toBe("Meals 2026-10-12 to 2026-10-18");
  });
});

describe("list edits", () => {
  const base = toList("l", { items: [] });
  it("adds, toggles, removes and clears checked items", () => {
    let l = addItem(base, { name: "soap", quantity: 2, unit: "", category: "Other" });
    l = addItem(l, { name: "bananas", quantity: 6, unit: "", category: "Produce" });
    const [soap, bananas] = l.items;
    l = toggleItem(l, soap.id, true);
    expect(l.items.filter((i) => i.checked).map((i) => i.name)).toEqual(["soap"]);
    expect(clearChecked(l).items.map((i) => i.name)).toEqual(["bananas"]);
    expect(removeItem(l, bananas.id).items.map((i) => i.name)).toEqual(["soap"]);
    expect(base.items).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  addItem, buildBuyList, mergePlanIntoList, clearChecked, dropRecipeFromWeek, isEmptyWeek, removeItem, setPick,
  toList, toRecipe, toWeekPlan, toggleItem, type Recipe,
  DEFAULT_SETTINGS, fromSettings, setItemPrice, setShoppedOn, toSettings,
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
const W = "2026-10-12";

describe("reading documents defensively", () => {
  it("fills defaults for missing or wrong-typed fields", () => {
    expect(toRecipe("r", { title: 5, servings: "x", tags: ["a", 1], ingredients: [null, { name: "x", quantity: "1" }] })).toEqual({
      id: "r", title: "Untitled", servings: 1, tags: ["a"], instructions: "", sourceUrl: null,
      ingredients: [{ name: "", quantity: 0, unit: "" }, { name: "x", quantity: 0, unit: "" }],
    });
    expect(toWeekPlan(W, {})).toEqual({ weekStart: W, picks: [], listId: null });
    expect(toList("l", { items: [{ id: "i", name: "milk", checked: "yes" }] }).items[0]).toMatchObject({ checked: false, quantity: 1 });
  });
});

describe("reading a week", () => {
  it("keeps good picks once each and ignores damaged ones", () => {
    const w = toWeekPlan(W, {
      picks: [
        { recipeId: "a", servings: 4 },
        { recipeId: "a", servings: 9 }, // a food is picked once
        { recipeId: "b", servings: 2.4 }, // rounded
        { recipeId: "c", servings: 0 },
        { recipeId: "d", servings: 101 },
        { recipeId: "", servings: 2 },
        { servings: 2 },
        null,
      ],
      listId: "l1",
    });
    expect(w).toEqual({ weekStart: W, picks: [{ recipeId: "a", servings: 4 }, { recipeId: "b", servings: 2 }], listId: "l1" });
    expect(toWeekPlan(W, { picks: "x", listId: 5 })).toEqual({ weekStart: W, picks: [], listId: null });
  });
});

describe("choosing foods for the week", () => {
  it("picks, changes servings and unpicks, keeping the order picked", () => {
    let w = setPick(undefined, W, "pasta", 4);
    w = setPick(w, W, "bake", 2);
    w = setPick(w, W, "pasta", 6);
    expect(w.picks).toEqual([{ recipeId: "pasta", servings: 6 }, { recipeId: "bake", servings: 2 }]);
    expect(setPick(w, W, "pasta", null).picks).toEqual([{ recipeId: "bake", servings: 2 }]);
    expect(setPick(undefined, W, "x", null)).toEqual({ weekStart: W, picks: [], listId: null });
  });
  it("keeps the started list when picks change, and does not mutate", () => {
    const w = { weekStart: W, picks: [{ recipeId: "pasta", servings: 4 }], listId: "l1" };
    const frozen = JSON.stringify(w);
    expect(setPick(w, W, "pasta", null).listId).toBe("l1");
    dropRecipeFromWeek(w, "pasta");
    expect(JSON.stringify(w)).toBe(frozen);
  });
  it("drops a deleted food, and a week with nothing in it is empty", () => {
    const w = setPick(setPick(undefined, W, "a", 1), W, "b", 1);
    expect(dropRecipeFromWeek(w, "a").picks.map((p) => p.recipeId)).toEqual(["b"]);
    expect(isEmptyWeek(dropRecipeFromWeek(dropRecipeFromWeek(w, "a"), "b"))).toBe(true);
    expect(isEmptyWeek({ ...w, picks: [], listId: "l1" })).toBe(false);
  });
});

describe("buildBuyList", () => {
  const picks = [{ recipeId: "pasta", servings: 6 }, { recipeId: "bake", servings: 2 }];

  it("scales each food to the servings picked, merges and categorises (same numbers as the Next app)", () => {
    const r = buildBuyList(picks, [pasta, bake]);
    expect(r.items.map(({ id, ...rest }) => ({ ...rest, id: typeof id }))).toEqual([
      { name: "milk", quantity: 3, unit: "cup", category: "Dairy & eggs", checked: false, price: null, fromPlan: true, id: "string" },
      { name: "spaghetti", quantity: 1.6, unit: "kg", category: "Pantry", checked: false, price: null, fromPlan: true, id: "string" },
      { name: "tomatoes", quantity: 4.5, unit: "", category: "Produce", checked: false, price: null, fromPlan: true, id: "string" },
    ]);
    expect(r.skipped).toEqual([]);
  });

  it("gives every line a distinct id", () => {
    const ids = buildBuyList(picks, [pasta, bake]).items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is empty for no picks and ignores foods that no longer exist", () => {
    expect(buildBuyList([], [pasta])).toEqual({ items: [], skipped: [] });
    const r = buildBuyList([{ recipeId: "gone", servings: 2 }, { recipeId: "bake", servings: 2 }], [bake]);
    expect(r.items.map((i) => i.name)).toEqual(["spaghetti"]);
    expect(r.skipped).toEqual([]); // a deleted food is not a "food without ingredients"
  });

  describe("foods that have no ingredients yet", () => {
    const empty1: Recipe = { id: "e1", title: "يخنة بازيلاء", servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients: [] };
    const empty2: Recipe = { ...empty1, id: "e2", title: "رز مع دجاج" };

    it("add nothing and are named while the rest is built", () => {
      const r = buildBuyList([{ recipeId: "e1", servings: 4 }, { recipeId: "bake", servings: 2 }], [bake, empty1]);
      expect(r.items.map((i) => i.name)).toEqual(["spaghetti"]);
      expect(r.skipped).toEqual(["يخنة بازيلاء"]);
    });

    it("give an empty list and name every one when nothing else is chosen", () => {
      const r = buildBuyList([{ recipeId: "e1", servings: 4 }, { recipeId: "e2", servings: 4 }], [empty1, empty2]);
      expect(r.items).toEqual([]);
      expect(r.skipped).toEqual(["يخنة بازيلاء", "رز مع دجاج"]);
    });
  });

  it("merges Arabic ingredients across foods, whichever way rice is spelled", () => {
    const rice1: Recipe = { id: "r1", title: "رز مع دجاج", servings: 4, tags: [], instructions: "", sourceUrl: null,
      ingredients: [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }] };
    const kofta: Recipe = { id: "r2", title: "كفتة مع بطاطس و ارز وطماطم", servings: 4, tags: [], instructions: "", sourceUrl: null,
      ingredients: [{ name: "رز", quantity: 1, unit: "كوب" }, { name: "بطاطس", quantity: 500, unit: "جم" }, { name: "طماطم", quantity: 3, unit: "حبة" }] };
    const r = buildBuyList([{ recipeId: "r1", servings: 4 }, { recipeId: "r2", servings: 4 }], [rice1, kofta]);
    expect(r.items.map(({ name, quantity, unit, category }) => ({ name, quantity, unit, category }))).toEqual([
      { name: "أرز", quantity: 3, unit: "cup", category: "Pantry" },
      { name: "بطاطس", quantity: 500, unit: "g", category: "Produce" },
      { name: "دجاج", quantity: 1, unit: "kg", category: "Meat & fish" },
      { name: "طماطم", quantity: 3, unit: "", category: "Produce" },
    ]);
  });

  it("scales down for one person from a four-person recipe", () => {
    const r = buildBuyList([{ recipeId: "pasta", servings: 1 }], [pasta]);
    expect(r.items.find((i) => i.name === "spaghetti")?.quantity).toBe(100);
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

describe("prices and the shopped-on date", () => {
  it("reads prices as whole kobo and ignores anything else", () => {
    const l = toList("l", {
      createdAt: "2026-10-12T08:00:00Z",
      items: [
        { id: "a", name: "rice", price: 250000 },
        { id: "b", name: "milk", price: 12.5 }, // not whole kobo
        { id: "c", name: "egg", price: -1 },
        { id: "d", name: "oil", price: "900" },
        { id: "e", name: "salt" },
        { id: "f", name: "free", price: 0 },
      ],
    });
    expect(l.items.map((i) => i.price)).toEqual([250000, null, null, null, null, 0]);
  });

  it("falls back to the creation date for lists made before there was a shopped-on date", () => {
    expect(toList("l", { createdAt: "2026-10-12T23:30:00Z" }).shoppedOn).toBe("2026-10-12");
    expect(toList("l", { createdAt: "2026-10-12T08:00:00Z", shoppedOn: "2026-10-17" }).shoppedOn).toBe("2026-10-17");
    expect(toList("l", { shoppedOn: "yesterday" }).shoppedOn).toBe("");
  });

  it("sets and clears a price, and changes the date, without touching anything else", () => {
    let l = addItem(toList("l", { createdAt: "2026-10-12T08:00:00Z" }), { name: "rice", quantity: 1, unit: "kg", category: "Pantry" });
    const id = l.items[0].id;
    l = setItemPrice(l, id, 250000);
    expect(l.items[0]).toMatchObject({ price: 250000, checked: false, name: "rice" });
    l = toggleItem(l, id, true);
    expect(setItemPrice(l, id, null).items[0]).toMatchObject({ price: null, checked: true });
    expect(setShoppedOn(l, "2026-10-20").shoppedOn).toBe("2026-10-20");
    expect(l.shoppedOn).toBe("2026-10-12");
  });

  it("addItem can carry a price", () => {
    const l = addItem(toList("l", {}), { name: "rice", quantity: 1, unit: "", category: null, price: 1000 });
    expect(l.items[0].price).toBe(1000);
  });
});

describe("settings", () => {
  it("uses safe defaults for a missing or damaged document", () => {
    expect(toSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(toSettings({ lang: "fr", currency: "EUR", rate: -3, weeklyBudget: "lots" })).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ lang: null, currency: "NGN", rate: 1380, weeklyBudget: null });
  });
  it("keeps good values, and an old document with only a language still reads", () => {
    expect(toSettings({ lang: "ar" })).toEqual({ lang: "ar", currency: "NGN", rate: 1380, weeklyBudget: null });
    expect(toSettings({ lang: "en", currency: "USD", rate: 1500, weeklyBudget: 5000000 })).toEqual({ lang: "en", currency: "USD", rate: 1500, weeklyBudget: 5000000 });
  });
  it("writes only the fields that are set", () => {
    expect(fromSettings({ ...DEFAULT_SETTINGS })).toEqual({ currency: "NGN", rate: 1380, weeklyBudget: null });
    expect(fromSettings({ ...DEFAULT_SETTINGS, lang: "ar" })).toMatchObject({ lang: "ar" });
  });
});

describe("mergePlanIntoList", () => {
  const plan = (id: string, name: string, quantity: number, extra: Record<string, unknown> = {}) => ({ id, name, quantity, unit: "", category: "Pantry", checked: false, price: null, fromPlan: true, ...extra });
  const listOf = (items: ReturnType<typeof plan>[], dismissed: string[] = []) => ({ ...toList("l", {}), items, dismissed });

  it("fills an empty list from what the foods need", () => {
    const r = mergePlanIntoList(undefined, [plan("rice|", "rice", 2)]);
    expect(r.items).toEqual([plan("rice|", "rice", 2)]);
    expect(r.dismissed).toEqual([]);
  });
  it("rescales a line and keeps its tick and price", () => {
    const l = listOf([plan("rice|", "rice", 2, { checked: true, price: 5000 })]);
    expect(mergePlanIntoList(l, [plan("rice|", "rice", 3)]).items[0]).toMatchObject({ quantity: 3, checked: true, price: 5000 });
  });
  it("leaves lines you added alone, and drops plan lines nobody needs unless they were ticked or priced", () => {
    const manual = { ...plan("m1", "soap", 1), fromPlan: false };
    const l = listOf([manual, plan("a|", "a", 1), plan("b|", "b", 1, { checked: true }), plan("c|", "c", 1, { price: 100 })]);
    const r = mergePlanIntoList(l, []);
    expect(r.items.map((i) => [i.name, i.fromPlan])).toEqual([["soap", false], ["b", false], ["c", false]]);
  });
  it("does not add back a line you removed, and forgets it once no food needs it", () => {
    const l = listOf([], ["salt|"]);
    expect(mergePlanIntoList(l, [plan("salt|", "salt", 1), plan("oil|", "oil", 1)]).items.map((i) => i.name)).toEqual(["oil"]);
    expect(mergePlanIntoList(l, [plan("salt|", "salt", 1)]).dismissed).toEqual(["salt|"]);
    expect(mergePlanIntoList(l, [plan("oil|", "oil", 1)]).dismissed).toEqual([]);
  });
  it("removing a plan line remembers it, removing a manual one does not", () => {
    const l = listOf([plan("a|", "a", 1), { ...plan("m1", "soap", 1), fromPlan: false }]);
    expect(removeItem(l, "a|").dismissed).toEqual(["a|"]);
    expect(removeItem(l, "m1").dismissed).toEqual([]);
  });
  it("old lists with no plan fields read as hand-made", () => {
    const l = toList("x", { items: [{ id: "i", name: "milk" }] });
    expect(l.items[0].fromPlan).toBe(false);
    expect(l.dismissed).toEqual([]);
  });
});

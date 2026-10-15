import { describe, expect, it } from "vitest";
import type { CollectionRef, Db, DocSnap, QuerySnap } from "./runtime";
import { addItem, removeItem, setItemPrice, setPick, toggleItem } from "./model";
import { createStore } from "./store";

/** A small in-memory stand-in for the claude.ai db: same shape, snapshots delivered asynchronously. */
function fakeDb(seed: Record<string, Record<string, Record<string, unknown>>> = {}) {
  const data = structuredClone(seed);
  const subs: { coll: string; next: (s: QuerySnap) => void }[] = [];
  const snap = (coll: string): QuerySnap => ({
    docs: Object.entries(data[coll] ?? {}).map(([id, d]): DocSnap => ({ id, exists: true, data: () => structuredClone(d) })),
  });
  const notify = (coll: string) => setTimeout(() => subs.filter((s) => s.coll === coll).forEach((s) => s.next(snap(coll))), 0);
  const db: Db = {
    collection(coll): CollectionRef {
      return {
        doc: (id = "x") => ({
          set: async (d) => {
            await new Promise((r) => setTimeout(r, 5));
            (data[coll] ??= {})[id] = structuredClone(d);
            notify(coll);
          },
          delete: async () => {
            delete data[coll]?.[id];
            notify(coll);
          },
        }),
        onSnapshot(next) {
          subs.push({ coll, next });
          setTimeout(() => next(snap(coll)), 0);
          return () => {};
        },
      };
    },
  };
  return { db, data };
}

const ready = async (store: ReturnType<typeof createStore>) => {
  for (let i = 0; i < 50 && store.getState().status !== "ready"; i++) await new Promise((r) => setTimeout(r, 5));
};

describe("settings writes merge instead of replacing", () => {
  it("saving a language keeps the budget, and saving a budget keeps the language", async () => {
    const { db, data } = fakeDb();
    const store = createStore(db);
    await ready(store);

    await store.updateSettings({ weeklyBudget: 5_000_000 });
    await store.updateSettings({ lang: "ar" });
    await store.updateSettings({ currency: "USD" });
    expect(data.meta.settings).toEqual({ lang: "ar", currency: "USD", rate: 1380, weeklyBudget: 5_000_000 });
    expect(store.getState().settings).toEqual({ lang: "ar", currency: "USD", rate: 1380, weeklyBudget: 5_000_000 });
  });

  it("fired back to back (no waiting) they still all land", async () => {
    const { db, data } = fakeDb();
    const store = createStore(db);
    await ready(store);
    await Promise.all([store.updateSettings({ lang: "en" }), store.updateSettings({ weeklyBudget: 123400 }), store.updateSettings({ rate: 1500 })]);
    expect(data.meta.settings).toEqual({ lang: "en", currency: "NGN", rate: 1500, weeklyBudget: 123400 });
  });

  it("an old settings document that only had a language is upgraded without losing it", async () => {
    const { db, data } = fakeDb({ meta: { settings: { lang: "ar" } } });
    const store = createStore(db);
    await ready(store);
    expect(store.getState().settings.lang).toBe("ar");
    await store.updateSettings({ weeklyBudget: 700000 });
    expect(data.meta.settings).toEqual({ lang: "ar", currency: "NGN", rate: 1380, weeklyBudget: 700000 });
  });

  it("two quick price edits on one list both land", async () => {
    const list = { name: "Trip", rangeStart: null, rangeEnd: null, createdAt: "2026-10-12T08:00:00Z", shoppedOn: "2026-10-12",
      items: [{ id: "a", name: "rice", quantity: 1, unit: "", category: null, checked: true, price: null }, { id: "b", name: "oil", quantity: 1, unit: "", category: null, checked: true, price: null }] };
    const { db, data } = fakeDb({ lists: { l1: list } });
    const store = createStore(db);
    await ready(store);
    const setPrice = (id: string, price: number) => store.updateList("l1", (l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, price } : i)) }));
    await Promise.all([setPrice("a", 250000), setPrice("b", 90000)]);
    expect((data.lists.l1.items as { price: number }[]).map((i) => i.price)).toEqual([250000, 90000]);
  });
});

describe("the week", () => {
  const recipe = (title: string) => ({ title, servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients: [{ name: "rice", quantity: 1, unit: "cup" }] });
  const W = "2026-10-12";

  it("quick successive picks all land, and unpicking everything deletes the week", async () => {
    const { db, data } = fakeDb({ recipes: { a: recipe("A"), b: recipe("B") } });
    const store = createStore(db);
    await ready(store);
    await Promise.all([
      store.updateWeek(W, (w) => setPick(w, W, "a", 4)),
      store.updateWeek(W, (w) => setPick(w, W, "b", 2)),
      store.updateWeek(W, (w) => setPick(w, W, "a", 6)),
    ]);
    expect(data.week[W]).toEqual({ picks: [{ recipeId: "a", servings: 6 }, { recipeId: "b", servings: 2 }], listId: `week-${W}` });
    expect(Object.keys(data.lists)).toEqual([`week-${W}`]); // quick edits made exactly one list
    await store.updateWeek(W, (w) => setPick(w, W, "a", null));
    await store.updateWeek(W, (w) => setPick(w, W, "b", null));
    expect(data.week?.[W]).toBeUndefined();
    expect(data.lists?.[`week-${W}`]).toBeUndefined(); // nothing picked, nothing bought: the list goes too
  });

  it("deleting a food takes it off every week and updates the lists", async () => {
    const { db, data } = fakeDb({
      recipes: { a: recipe("A"), b: recipe("B") },
      week: { [W]: { picks: [{ recipeId: "a", servings: 4 }, { recipeId: "b", servings: 2 }], listId: "l1" }, "2026-10-19": { picks: [{ recipeId: "a", servings: 1 }], listId: null } },
    });
    const store = createStore(db);
    await ready(store);
    await store.deleteRecipe("a");
    expect(data.recipes.a).toBeUndefined();
    expect(data.week[W]).toEqual({ picks: [{ recipeId: "b", servings: 2 }], listId: `week-${W}` });
    expect(data.week["2026-10-19"]).toBeUndefined();
    expect((data.lists[`week-${W}`].items as { name: string; quantity: number }[]).map((i) => [i.name, i.quantity])).toEqual([["rice", 0.5]]);
  });

  const names = (data: Record<string, Record<string, Record<string, unknown>>>) => (data.lists[`week-${W}`].items as { name: string }[]).map((i) => i.name);

  it("the first pick creates the week's list, filled from the foods, and later changes follow", async () => {
    const { db, data } = fakeDb({ recipes: { a: recipe("A"), b: { ...recipe("B"), ingredients: [{ name: "oil", quantity: 2, unit: "tbsp" }] } } });
    const store = createStore(db);
    await ready(store);
    expect(data.lists).toBeUndefined();
    await store.updateWeek(W, (w) => setPick(w, W, "a", 4));
    expect(data.lists[`week-${W}`]).toMatchObject({ rangeStart: W, rangeEnd: "2026-10-18", name: `Shopping ${W}` });
    expect(names(data)).toEqual(["rice"]);
    await store.updateWeek(W, (w) => setPick(w, W, "b", 2));
    expect(names(data).sort()).toEqual(["oil", "rice"]);
    await store.updateWeek(W, (w) => setPick(w, W, "a", 8)); // double the servings of A
    expect((data.lists[`week-${W}`].items as { name: string; quantity: number }[]).find((i) => i.name === "rice")!.quantity).toBe(2);
    await store.updateWeek(W, (w) => setPick(w, W, "a", null));
    expect(names(data)).toEqual(["oil"]);
  });

  it("keeps what you did: ticks, prices, items you added, bought lines no food needs, and removed lines stay removed", async () => {
    const { db, data } = fakeDb({ recipes: { a: recipe("A"), b: { ...recipe("B"), ingredients: [{ name: "oil", quantity: 2, unit: "tbsp" }, { name: "salt", quantity: 1, unit: "tsp" }] } } });
    const store = createStore(db);
    await ready(store);
    await store.updateWeek(W, (w) => setPick(w, W, "a", 4));
    await store.updateWeek(W, (w) => setPick(w, W, "b", 4));
    const id = `week-${W}`;
    const idOf = (n: string) => store.getState().lists.find((l) => l.id === id)!.items.find((i) => i.name === n)!.id;
    await store.updateList(id, (l) => toggleItem(setItemPrice(l, idOf("rice"), 250000), idOf("rice"), true));
    await store.updateList(id, (l) => addItem(l, { name: "soap", quantity: 1, unit: "", category: "Other" }));
    await store.updateList(id, (l) => removeItem(l, idOf("salt"))); // you already have salt
    await store.updateWeek(W, (w) => setPick(w, W, "a", 8)); // rescale: rice keeps its tick and price
    const items = () => data.lists[id].items as { name: string; quantity: number; checked: boolean; price: number | null; fromPlan: boolean }[];
    expect(items().find((i) => i.name === "rice")).toMatchObject({ quantity: 2, checked: true, price: 250000, fromPlan: true });
    expect(items().some((i) => i.name === "salt")).toBe(false); // still removed after the change
    await store.updateWeek(W, (w) => setPick(w, W, "a", null)); // no food needs rice now, but it was bought
    expect(items().find((i) => i.name === "rice")).toMatchObject({ checked: true, price: 250000, fromPlan: false });
    expect(items().map((i) => i.name).sort()).toEqual(["oil", "rice", "soap"]);
    await store.updateWeek(W, (w) => setPick(w, W, "b", null)); // all foods gone: plan lines go, yours stay, so does the list
    expect(items().map((i) => i.name).sort()).toEqual(["rice", "soap"]);
    expect(data.week[W].listId).toBe(id);
  });

  it("editing or deleting a food updates the list; two weeks make two lists", async () => {
    const { db, data } = fakeDb({ recipes: { a: recipe("A") } });
    const store = createStore(db);
    await ready(store);
    await store.updateWeek(W, (w) => setPick(w, W, "a", 4));
    await store.updateWeek("2026-10-19", (w) => setPick(w, "2026-10-19", "a", 4));
    expect(Object.keys(data.lists).sort()).toEqual([`week-${W}`, "week-2026-10-19"]);
    await store.saveRecipe({ ...recipe("A"), id: "a", ingredients: [{ name: "lentils", quantity: 1, unit: "cup" }] });
    expect(names(data)).toEqual(["lentils"]);
    await store.deleteRecipe("a");
    expect(data.lists?.[`week-${W}`]).toBeUndefined();
    expect(data.lists?.["week-2026-10-19"]).toBeUndefined();
  });

  it("writes nothing when the list is already right", async () => {
    const { db } = fakeDb({ recipes: { a: recipe("A") } });
    const store = createStore(db);
    await ready(store);
    await store.updateWeek(W, (w) => setPick(w, W, "a", 4));
    const before = JSON.stringify(store.getState().lists);
    await store.updateWeek(W, (w) => setPick(w, W, "a", 4));
    expect(JSON.stringify(store.getState().lists)).toBe(before);
    expect(store.getState().lists).toHaveLength(1);
  });
});

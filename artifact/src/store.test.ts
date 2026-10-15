import { describe, expect, it } from "vitest";
import type { CollectionRef, Db, DocSnap, QuerySnap } from "./runtime";
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

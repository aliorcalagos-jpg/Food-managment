import { useSyncExternalStore } from "react";
import { addDays, parseISODate, toISODate } from "../../lib/week";
import {
  buildBuyList, DEFAULT_SETTINGS, weekListId, dropRecipeFromWeek, mergePlanIntoList, fromSettings, isEmptyWeek, newId, toList, toRecipe, toSettings, toWeekPlan,
  type Recipe, type Settings, type ShoppingList, type WeekPlan,
} from "./model";
import type { Db, DocSnap } from "./runtime";
import { todayISO } from "./today";

export type State = {
  status: "loading" | "ready" | "unavailable";
  recipes: Recipe[];
  weeks: WeekPlan[];
  lists: ShoppingList[];
  /** Language, currency, exchange rate and weekly budget (defaults until saved). */
  settings: Settings;
  /** Why the last save failed (the runtime's own message), shown to the viewer until dismissed. */
  error: string | null;
};

export const EXAMPLE_TAG = "example";

type CollectionName = "recipes" | "week" | "lists" | "meta";

export type Store = ReturnType<typeof createStore>;

/** JSON with sorted keys, so two documents compare equal whatever order the server returns fields in. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}
const sameDoc = (a: unknown, b: unknown) => stable(a) === stable(b);

export function createStore(db: Db | null) {
  let state: State = {
    status: db ? "loading" : "unavailable",
    recipes: [],
    weeks: [],
    lists: [],
    settings: DEFAULT_SETTINGS,
    error: null,
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<State>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  // A document we have edited stays authoritative until a snapshot actually shows our edit. Without
  // this, a snapshot for an EARLIER save can arrive after a LATER local edit and revert it; the next
  // edit would then be built from that stale copy and silently lose data.
  type Doc = Record<string, unknown>;
  type Override = { name: CollectionName; id: string; data: Doc | null; settledAt: number | null };
  const overrides = new Map<string, Override>();
  const GRACE_MS = 10_000; // after a save succeeds, how long a snapshot may take to catch up

  const reconcile = (name: CollectionName, docs: DocSnap[]) => {
    for (const [key, o] of overrides) {
      if (o.name !== name) continue;
      const server = docs.find((d) => d.id === o.id && d.exists)?.data() ?? null;
      const caughtUp = sameDoc(server, o.data);
      const gaveUp = o.settledAt !== null && Date.now() - o.settledAt > GRACE_MS;
      if (caughtUp || gaveUp) overrides.delete(key);
      else putLocal(name, o.id, o.data); // keep our newer version on screen
    }
  };

  // Subscribe once per collection; every view is derived from this state.
  if (db) {
    const waiting = new Set<CollectionName>(["recipes", "week", "lists", "meta"]);
    const watch = (name: CollectionName, apply: (docs: DocSnap[]) => Partial<State>) =>
      db.collection(name).onSnapshot(
        (snap) => {
          waiting.delete(name);
          set({ ...apply(snap.docs.filter((d) => d.exists)), ...(waiting.size === 0 ? { status: "ready" as const } : {}) });
          reconcile(name, snap.docs);
        },
        (e) => set({ status: "unavailable", error: e.message }),
      );
    watch("recipes", (docs) => ({ recipes: docs.map((d) => toRecipe(d.id, d.data() ?? {})) }));
    watch("week", (docs) => ({ weeks: docs.map((d) => toWeekPlan(d.id, d.data() ?? {})) }));
    watch("lists", (docs) => ({ lists: docs.map((d) => toList(d.id, d.data() ?? {})) }));
    watch("meta", (docs) => ({ settings: toSettings(docs.find((d) => d.id === "settings")?.data()) }));
  }

  // Own edits go into local state at once (before the save finishes), so the next edit builds on
  // them instead of on a snapshot that hasn't arrived yet, and the UI never waits on the network.
  // A failed save puts the previous value back.
  const localDoc = (name: CollectionName, id: string): Doc | null | undefined => {
    if (name === "meta") return fromSettings(state.settings);
    if (name === "recipes") return state.recipes.find((r) => r.id === id) as unknown as Doc | undefined ?? null;
    if (name === "lists") return state.lists.find((l) => l.id === id) as unknown as Doc | undefined ?? null;
    return state.weeks.find((w) => w.weekStart === id) as unknown as Doc | undefined ?? null;
  };
  const putLocal = (name: CollectionName, id: string, doc: Doc | null) => {
    if (name === "meta") {
      set({ settings: toSettings(doc) });
    } else if (name === "recipes") {
      const rest = state.recipes.filter((r) => r.id !== id);
      set({ recipes: doc ? [...rest, toRecipe(id, doc)] : rest });
    } else if (name === "lists") {
      const rest = state.lists.filter((l) => l.id !== id);
      set({ lists: doc ? [...rest, toList(id, doc)] : rest });
    } else {
      const rest = state.weeks.filter((w) => w.weekStart !== id);
      set({ weeks: doc ? [...rest, toWeekPlan(id, doc)] : rest });
    }
  };

  // db contract: one write at a time per document, and only on a user action.
  // The body is computed when the job RUNS, from the latest state. compute returns the new
  // body, null to delete, or undefined to do nothing. Resolves true when the save succeeded.
  const queues = new Map<string, Promise<boolean>>();
  function write(name: CollectionName, id: string, compute: () => Doc | null | undefined): Promise<boolean> {
    const key = `${name}/${id}`;
    const job = async (): Promise<boolean> => {
      const data = compute();
      if (data === undefined) return true;
      const before = localDoc(name, id);
      const mine: Override = { name, id, data, settledAt: null };
      overrides.set(key, mine);
      putLocal(name, id, data);
      try {
        if (!db) throw new Error("storage is unavailable");
        const ref = db.collection(name).doc(id);
        await (data ? ref.set(data) : ref.delete());
        mine.settledAt = Date.now();
        return true;
      } catch (e) {
        overrides.delete(key);
        putLocal(name, id, before ?? null);
        set({ error: (e as { message?: string })?.message ?? "unknown error" });
        return false;
      }
    };
    const next = (queues.get(key) ?? Promise.resolve(true)).then(job);
    queues.set(key, next);
    return next;
  }

  let namer: (weekStart: string) => string = (w) => `Shopping ${w}`;

  const writeWeek = (weekStart: string, edit: (week: WeekPlan | undefined) => WeekPlan) =>
    write("week", weekStart, () => {
      const next = edit(state.weeks.find((w) => w.weekStart === weekStart));
      return isEmptyWeek(next) ? null : { picks: next.picks, listId: next.listId };
    });

  /** The one shopping list of a week has a fixed id, so quick successive edits can never make two. */
  async function syncWeekList(weekStart: string): Promise<void> {
    const id = weekListId(weekStart);
    await write("lists", id, () => {
      const picks = state.weeks.find((w) => w.weekStart === weekStart)?.picks ?? [];
      const cur = state.lists.find((l) => l.id === id);
      const { items, dismissed } = mergePlanIntoList(cur, buildBuyList(picks, state.recipes).items);
      if (!cur && items.length === 0) return undefined; // nothing to buy yet: no list
      if (cur && picks.length === 0 && items.length === 0) return null; // nothing left to buy and no foods: the list goes
      const { id: _id, ...rest } = cur ?? ({} as ShoppingList);
      void _id;
      const start = parseISODate(weekStart);
      const base = cur
        ? rest
        : { name: namer(weekStart), rangeStart: weekStart, rangeEnd: start ? toISODate(addDays(start, 6)) : null, createdAt: new Date().toISOString(), shoppedOn: todayISO() };
      const next = { ...base, items, dismissed };
      return cur && sameDoc(next, rest) ? undefined : next;
    });
    await write("week", weekStart, () => {
      const w = state.weeks.find((x) => x.weekStart === weekStart);
      if (!w) return undefined;
      const wanted = state.lists.some((l) => l.id === id) ? id : null;
      if (w.listId === wanted) return undefined;
      const next = { ...w, listId: wanted };
      return isEmptyWeek(next) ? null : { picks: next.picks, listId: next.listId };
    });
  }

  const store = {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getState: () => state,
    dismissError: () => set({ error: null }),

    /** Names the list made for a week (the page registers a language-aware one). */
    setListNamer(fn: (weekStart: string) => string) {
      namer = fn;
    },

    /** Resolves the recipe id, or null if it could not be saved. The lists of weeks that use the food follow its new ingredients. */
    async saveRecipe(r: Omit<Recipe, "id"> & { id?: string }): Promise<string | null> {
      const { id = newId(), ...data } = r;
      if (!(await write("recipes", id, () => data))) return null;
      for (const w of state.weeks.filter((x) => x.picks.some((p) => p.recipeId === id))) await syncWeekList(w.weekStart);
      return id;
    },

    /** Removes the food, takes it off every week it was chosen for, and updates those weeks' lists. */
    async deleteRecipe(id: string) {
      const affected = state.weeks.filter((w) => w.picks.some((p) => p.recipeId === id));
      for (const week of affected) await writeWeek(week.weekStart, (cur) => dropRecipeFromWeek(cur ?? week, id));
      await write("recipes", id, () => null);
      for (const week of affected) await syncWeekList(week.weekStart);
    },

    /**
     * Edits the foods chosen for one week, then brings that week's shopping list in step: the list is created when
     * the first food is picked and follows every later change. A week with nothing chosen and no list is deleted.
     */
    async updateWeek(weekStart: string, edit: (week: WeekPlan | undefined) => WeekPlan) {
      const ok = await writeWeek(weekStart, edit);
      await syncWeekList(weekStart);
      return ok;
    },

    /** Resolves the new list's id, or null if it could not be saved. */
    async createList(list: Omit<ShoppingList, "id">): Promise<string | null> {
      const id = newId();
      return (await write("lists", id, () => ({ ...list }))) ? id : null;
    },
    /** Edits a list; does nothing if it no longer exists. */
    updateList: (id: string, edit: (list: ShoppingList) => ShoppingList) =>
      write("lists", id, () => {
        const cur = state.lists.find((l) => l.id === id);
        if (!cur) return undefined;
        const { id: _id, ...data } = edit(cur);
        void _id;
        return data;
      }),
    deleteList: (id: string) => write("lists", id, () => null),

    /**
     * Changes some settings and keeps the rest. The new document is built from the latest settings when the
     * write runs, so saving a language can never erase the budget (or the other way round).
     */
    updateSettings: (patch: Partial<Settings>) => write("meta", "settings", () => fromSettings({ ...state.settings, ...patch })),

    /** Applies the writes of an import (see `planImport`), one document at a time. Resolves false if any save failed. */
    async applyImport(ops: { name: CollectionName; id: string; data: Doc | null }[]): Promise<boolean> {
      let ok = true;
      for (const op of ops) ok = (await write(op.name, op.id, () => op.data)) && ok;
      return ok;
    },

    async removeExamples() {
      for (const r of state.recipes.filter((x) => x.tags.includes(EXAMPLE_TAG))) await store.deleteRecipe(r.id);
    },
  };
  return store;
}

export function useStore(store: Store): State {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

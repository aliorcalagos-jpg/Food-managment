import { useSyncExternalStore } from "react";
import type { Lang } from "./i18n";
import { dropRecipe, newId, toList, toPlanDay, toRecipe, type PlanDay, type Recipe, type ShoppingList } from "./model";
import type { Db, DocSnap } from "./runtime";

export type State = {
  status: "loading" | "ready" | "unavailable";
  recipes: Recipe[];
  days: PlanDay[];
  lists: ShoppingList[];
  /** The saved language, or null until one has been chosen (the page then uses its default). */
  lang: Lang | null;
  /** Why the last save failed (the runtime's own message), shown to the viewer until dismissed. */
  error: string | null;
};

export const EXAMPLE_TAG = "example";

type CollectionName = "recipes" | "plan" | "lists" | "meta";

const asLang = (v: unknown): Lang | null => (v === "en" || v === "ar" ? v : null);
export type Store = ReturnType<typeof createStore>;

export function createStore(db: Db | null) {
  let state: State = {
    status: db ? "loading" : "unavailable",
    recipes: [],
    days: [],
    lists: [],
    lang: null,
    error: null,
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<State>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  // Subscribe once per collection; every view is derived from this state.
  if (db) {
    const waiting = new Set<CollectionName>(["recipes", "plan", "lists", "meta"]);
    const watch = (name: CollectionName, apply: (docs: DocSnap[]) => Partial<State>) =>
      db.collection(name).onSnapshot(
        (snap) => {
          waiting.delete(name);
          set({ ...apply(snap.docs.filter((d) => d.exists)), ...(waiting.size === 0 ? { status: "ready" as const } : {}) });
        },
        (e) => set({ status: "unavailable", error: e.message }),
      );
    watch("recipes", (docs) => ({ recipes: docs.map((d) => toRecipe(d.id, d.data() ?? {})) }));
    watch("plan", (docs) => ({ days: docs.map((d) => toPlanDay(d.id, d.data() ?? {})) }));
    watch("lists", (docs) => ({ lists: docs.map((d) => toList(d.id, d.data() ?? {})) }));
    watch("meta", (docs) => ({ lang: asLang(docs.find((d) => d.id === "settings")?.data()?.lang) }));
  }

  // Own edits go into local state at once (before the save finishes), so the next edit builds on
  // them instead of on a snapshot that hasn't arrived yet, and the UI never waits on the network.
  // A later snapshot replaces them; a failed save puts the previous value back.
  type Doc = Record<string, unknown>;
  const localDoc = (name: CollectionName, id: string): Doc | null | undefined => {
    if (name === "meta") return state.lang ? { lang: state.lang } : null;
    if (name === "recipes") return state.recipes.find((r) => r.id === id) as unknown as Doc | undefined ?? null;
    if (name === "lists") return state.lists.find((l) => l.id === id) as unknown as Doc | undefined ?? null;
    return state.days.find((d) => d.date === id) as unknown as Doc | undefined ?? null;
  };
  const putLocal = (name: CollectionName, id: string, doc: Doc | null) => {
    if (name === "meta") {
      set({ lang: asLang(doc?.lang) });
    } else if (name === "recipes") {
      const rest = state.recipes.filter((r) => r.id !== id);
      set({ recipes: doc ? [...rest, toRecipe(id, doc)] : rest });
    } else if (name === "lists") {
      const rest = state.lists.filter((l) => l.id !== id);
      set({ lists: doc ? [...rest, toList(id, doc)] : rest });
    } else {
      const rest = state.days.filter((d) => d.date !== id);
      set({ days: doc ? [...rest, toPlanDay(id, doc)] : rest });
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
      putLocal(name, id, data);
      try {
        if (!db) throw new Error("storage is unavailable");
        const ref = db.collection(name).doc(id);
        await (data ? ref.set(data) : ref.delete());
        return true;
      } catch (e) {
        putLocal(name, id, before ?? null);
        set({ error: (e as { message?: string })?.message ?? "unknown error" });
        return false;
      }
    };
    const next = (queues.get(key) ?? Promise.resolve(true)).then(job);
    queues.set(key, next);
    return next;
  }

  const store = {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getState: () => state,
    dismissError: () => set({ error: null }),

    /** Resolves the recipe id, or null if it could not be saved. */
    async saveRecipe(r: Omit<Recipe, "id"> & { id?: string }): Promise<string | null> {
      const { id = newId(), ...data } = r;
      return (await write("recipes", id, () => data)) ? id : null;
    },

    /** Removes the recipe and every planned meal that used it (the Next app does this with a DB cascade). */
    async deleteRecipe(id: string) {
      for (const day of state.days.filter((d) => d.entries.some((e) => e.recipeId === id))) {
        await store.updateDay(day.date, (d) => dropRecipe(d ?? day, id));
      }
      await write("recipes", id, () => null);
    },

    /** Edits one day of the plan. A day left with no meals is deleted rather than stored empty. */
    updateDay: (date: string, edit: (day: PlanDay | undefined) => PlanDay) =>
      write("plan", date, () => {
        const next = edit(state.days.find((d) => d.date === date));
        return next.entries.length ? { entries: next.entries } : null;
      }),

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

    /** Remembers the language in the db so every device agrees. */
    setLang: (lang: Lang) => write("meta", "settings", () => ({ lang })),

    async removeExamples() {
      for (const r of state.recipes.filter((x) => x.tags.includes(EXAMPLE_TAG))) await store.deleteRecipe(r.id);
    },
  };
  return store;
}

export function useStore(store: Store): State {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

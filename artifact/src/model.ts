// Document shapes stored in the artifact's db, plus the pure functions that edit them.
// Nothing here touches the db or the DOM, so it is all unit-testable.
import type { Ingredient } from "../../lib/ingredients";
import { buildListItems, sourcesByItem, type Source } from "../../lib/list-build";
import { DEFAULT_RATE, isCurrency, MAX_KOBO, type Currency } from "../../lib/money";
import type { Lang } from "./i18n";

export type { Ingredient };

export type Recipe = {
  id: string;
  title: string;
  servings: number;
  tags: string[];
  instructions: string;
  sourceUrl: string | null;
  ingredients: Ingredient[];
};

/** One food chosen for a week, and how many servings of it to cook. */
export type Pick = { recipeId: string; servings: number };
/** The foods chosen for one Monday-to-Sunday week, and the shopping list started from them (if any). */
export type WeekPlan = { weekStart: string; picks: Pick[]; listId: string | null };

export type ListItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  checked: boolean;
  /** What this whole line cost, in whole kobo (naira x 100); null until a price is entered. */
  price: number | null;
  /** True for a line the week's foods put on the list (the list keeps those in step with the foods). */
  fromPlan?: boolean;
};
export type ShoppingList = {
  id: string;
  name: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  createdAt: string;
  /** The day of the shopping trip (YYYY-MM-DD). Bought items count towards the week of this date. */
  shoppedOn: string;
  items: ListItem[];
  /** Ids of plan lines the person removed, so they are not added back while foods still need them. */
  dismissed?: string[];
};

export type Settings = {
  /** null until a language has been chosen on some device (the page then uses its default). */
  lang: Lang | null;
  /** Which currency amounts are shown (and typed) in. Stored amounts are always naira. */
  currency: Currency;
  /** Naira per US dollar; fixed, only changed on purpose. */
  rate: number;
  /** Weekly food budget in kobo, or null for none. */
  weeklyBudget: number | null;
};
export const DEFAULT_SETTINGS: Settings = { lang: null, currency: "NGN", rate: DEFAULT_RATE, weeklyBudget: null };

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ---- reading documents defensively (the db is untyped JSON) --------------------------------

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function toRecipe(id: string, d: Record<string, unknown>): Recipe {
  return {
    id,
    title: str(d.title, "Untitled"),
    servings: Math.max(1, Math.round(num(d.servings, 1))),
    tags: arr(d.tags).filter((t): t is string => typeof t === "string"),
    instructions: str(d.instructions),
    sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl : null,
    ingredients: arr(d.ingredients).map((i) => {
      const o = obj(i);
      return { name: str(o.name), quantity: num(o.quantity), unit: str(o.unit) };
    }),
  };
}

export function toWeekPlan(weekStart: string, d: Record<string, unknown>): WeekPlan {
  const seen = new Set<string>();
  const picks: Pick[] = [];
  for (const p of arr(d.picks)) {
    const o = obj(p);
    const recipeId = str(o.recipeId);
    const servings = Math.round(num(o.servings, 0));
    // one entry per food; ignore anything that is not a usable pick
    if (recipeId && servings >= 1 && servings <= 100 && !seen.has(recipeId)) {
      seen.add(recipeId);
      picks.push({ recipeId, servings });
    }
  }
  return { weekStart, picks, listId: typeof d.listId === "string" && d.listId ? d.listId : null };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const price = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_KOBO ? v : null;

export function toList(id: string, d: Record<string, unknown>): ShoppingList {
  const createdAt = str(d.createdAt);
  return {
    id,
    name: str(d.name, "Shopping list"),
    rangeStart: typeof d.rangeStart === "string" ? d.rangeStart : null,
    rangeEnd: typeof d.rangeEnd === "string" ? d.rangeEnd : null,
    createdAt,
    // lists made before prices existed have no shopped-on date: use the day they were created
    shoppedOn: ISO_DATE.test(str(d.shoppedOn)) ? str(d.shoppedOn) : ISO_DATE.test(createdAt.slice(0, 10)) ? createdAt.slice(0, 10) : "",
    items: arr(d.items).map((i) => {
      const o = obj(i);
      return {
        id: str(o.id),
        name: str(o.name),
        quantity: num(o.quantity, 1),
        unit: str(o.unit),
        category: typeof o.category === "string" ? o.category : null,
        checked: o.checked === true,
        price: price(o.price),
        fromPlan: o.fromPlan === true,
      };
    }),
    dismissed: arr(d.dismissed).filter((x): x is string => typeof x === "string"),
  };
}

export function toSettings(d: Record<string, unknown> | null | undefined): Settings {
  const o = d ?? {};
  return {
    lang: o.lang === "en" || o.lang === "ar" ? o.lang : null,
    currency: isCurrency(o.currency) ? o.currency : DEFAULT_SETTINGS.currency,
    rate: typeof o.rate === "number" && Number.isFinite(o.rate) && o.rate > 0 ? o.rate : DEFAULT_SETTINGS.rate,
    weeklyBudget: price(o.weeklyBudget),
  };
}

/** The document form of settings. Fields that were never set are left out, not written as null. */
export function fromSettings(s: Settings): Record<string, unknown> {
  return { ...(s.lang ? { lang: s.lang } : {}), currency: s.currency, rate: s.rate, weeklyBudget: s.weeklyBudget };
}

// ---- the week's foods ----------------------------------------------------------------------

const emptyWeek = (weekStart: string): WeekPlan => ({ weekStart, picks: [], listId: null });

/** Chooses a food for the week, changes its servings, or (servings null) takes it off. Keeps the order picked. */
export function setPick(week: WeekPlan | undefined, weekStart: string, recipeId: string, servings: number | null): WeekPlan {
  const w = week ?? emptyWeek(weekStart);
  if (servings === null) return { ...w, picks: w.picks.filter((p) => p.recipeId !== recipeId) };
  const exists = w.picks.some((p) => p.recipeId === recipeId);
  return {
    ...w,
    picks: exists ? w.picks.map((p) => (p.recipeId === recipeId ? { ...p, servings } : p)) : [...w.picks, { recipeId, servings }],
  };
}

/** Removes a food from a week (used when the food is deleted). */
export const dropRecipeFromWeek = (week: WeekPlan, recipeId: string): WeekPlan => ({ ...week, picks: week.picks.filter((p) => p.recipeId !== recipeId) });

/** A week with nothing chosen and no list started is not worth storing. */
export const isEmptyWeek = (w: WeekPlan) => w.picks.length === 0 && w.listId === null;

export type BuyList = {
  /** What to buy, merged across the chosen foods and grouped later by aisle. Ids are stable for the same line. */
  items: ListItem[];
  /** Chosen foods that have no ingredients yet, so they add nothing to the list. */
  skipped: string[];
  /** Which chosen foods need each line and how much (keyed by `itemKey(name, unit)`); lines you added by hand have none. */
  sources: Map<string, Source[]>;
};

/**
 * What to buy for the chosen foods: each food's ingredients are scaled from the servings its recipe makes to the
 * servings picked, then everything is merged (same name and unit add up). Picks whose food no longer exists are ignored.
 */
export function buildBuyList(picks: Pick[], recipes: Recipe[]): BuyList {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const chosen = picks.flatMap((p) => {
    const recipe = byId.get(p.recipeId);
    return recipe ? [{ servings: p.servings, recipe }] : [];
  });
  const skipped = chosen.filter((m) => m.recipe.ingredients.length === 0).map((m) => m.recipe.title);
  const items: ListItem[] = buildListItems(chosen.filter((m) => m.recipe.ingredients.length > 0)).map((i) => ({
    ...i,
    id: `${i.name}|${i.unit}`,
    checked: false,
    price: null,
    fromPlan: true,
  }));
  const sources = sourcesByItem(chosen.filter((m) => m.recipe.ingredients.length > 0).map((m) => ({ ...m, title: m.recipe.title })));
  return { items, skipped, sources };
}

// ---- shopping lists ------------------------------------------------------------------------

/** The id of the shopping list that belongs to the week starting on this Monday (YYYY-MM-DD). */
export const weekListId = (weekStart: string): string => `week-${weekStart}`;

export const toggleItem = (list: ShoppingList, itemId: string, checked: boolean): ShoppingList => ({
  ...list,
  items: list.items.map((i) => (i.id === itemId ? { ...i, checked } : i)),
});
/** Removes a line. A line the foods put there is remembered as dismissed, so the list does not add it back. */
export const removeItem = (list: ShoppingList, itemId: string): ShoppingList => {
  const gone = list.items.find((i) => i.id === itemId);
  return {
    ...list,
    items: list.items.filter((i) => i.id !== itemId),
    dismissed: gone?.fromPlan ? [...new Set([...(list.dismissed ?? []), itemId])] : list.dismissed,
  };
};

/**
 * Brings a week's list in step with what its foods need. Lines you added stay; lines from the foods are added,
 * rescaled or dropped, but keep what you did to them (ticked, priced). A line nobody needs any more stays (as an
 * ordinary line) if it was ticked or priced and goes otherwise. Lines you removed are not added back while a food needs them.
 */
export function mergePlanIntoList(list: ShoppingList | undefined, buy: ListItem[]): { items: ListItem[]; dismissed: string[] } {
  const dismissed = new Set(list?.dismissed ?? []);
  const needed = new Map(buy.map((i) => [i.id, i]));
  const items: ListItem[] = [];
  for (const e of list?.items ?? []) {
    if (!e.fromPlan) {
      items.push(e);
      continue;
    }
    const p = needed.get(e.id);
    if (p && !dismissed.has(e.id)) {
      items.push({ ...e, name: p.name, quantity: p.quantity, unit: p.unit, category: p.category, fromPlan: true });
      needed.delete(e.id);
    } else if (e.checked || e.price !== null) items.push({ ...e, fromPlan: false });
  }
  for (const p of needed.values()) if (!dismissed.has(p.id)) items.push({ ...p, fromPlan: true });
  return { items, dismissed: [...dismissed].filter((id) => buy.some((b) => b.id === id)) };
}
export const clearChecked = (list: ShoppingList): ShoppingList => ({ ...list, items: list.items.filter((i) => !i.checked) });
export const addItem = (list: ShoppingList, item: Omit<ListItem, "id" | "checked" | "price"> & { price?: number | null }): ShoppingList => ({
  ...list,
  items: [...list.items, { ...item, id: newId(), checked: false, price: item.price ?? null }],
});
/** Sets (or clears, with null) what a line cost. */
export const setItemPrice = (list: ShoppingList, itemId: string, price: number | null): ShoppingList => ({
  ...list,
  items: list.items.map((i) => (i.id === itemId ? { ...i, price } : i)),
});
export const setShoppedOn = (list: ShoppingList, shoppedOn: string): ShoppingList => ({ ...list, shoppedOn });

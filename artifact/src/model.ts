// Document shapes stored in the artifact's db, plus the pure functions that edit them.
// Nothing here touches the db or the DOM, so it is all unit-testable.
import type { Ingredient } from "../../lib/ingredients";
import { buildListItems } from "../../lib/list-build";
import type { MealTypeName } from "../../lib/meals";
import { DEFAULT_RATE, isCurrency, MAX_KOBO, type Currency } from "../../lib/money";
import type { Lang, Msg } from "./i18n";
import { addDays, parseISODate, toISODate } from "../../lib/week";

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

export type PlanEntry = { id: string; mealType: MealTypeName; recipeId: string; servings: number };
export type PlanDay = { date: string; entries: PlanEntry[] };

export type ListItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  checked: boolean;
  /** What this whole line cost, in whole kobo (naira x 100); null until a price is entered. */
  price: number | null;
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

export function toPlanDay(date: string, d: Record<string, unknown>): PlanDay {
  return {
    date,
    entries: arr(d.entries).map((e) => {
      const o = obj(e);
      return {
        id: str(o.id),
        mealType: str(o.mealType, "DINNER") as MealTypeName,
        recipeId: str(o.recipeId),
        servings: Math.max(1, Math.round(num(o.servings, 1))),
      };
    }),
  };
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
      };
    }),
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

// ---- meal plan edits -----------------------------------------------------------------------

const emptyDay = (date: string): PlanDay => ({ date, entries: [] });

export function addMeal(day: PlanDay | undefined, date: string, entry: PlanEntry): PlanDay {
  const d = day ?? emptyDay(date);
  return { ...d, entries: [...d.entries, entry] };
}

export function setMealServings(day: PlanDay, entryId: string, servings: number): PlanDay {
  return { ...day, entries: day.entries.map((e) => (e.id === entryId ? { ...e, servings } : e)) };
}

export function removeMeal(day: PlanDay, entryId: string): PlanDay {
  return { ...day, entries: day.entries.filter((e) => e.id !== entryId) };
}

/** Removes every entry for a recipe (used when the recipe is deleted). */
export function dropRecipe(day: PlanDay, recipeId: string): PlanDay {
  return { ...day, entries: day.entries.filter((e) => e.recipeId !== recipeId) };
}

// ---- shopping lists ------------------------------------------------------------------------

export function datesInRange(startISO: string, endISO: string): string[] {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end || end < start) return [];
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(toISODate(d));
  return out;
}

export const MAX_LIST_RANGE_DAYS = 62;

export type GenerateResult =
  | { ok: true; list: Omit<ShoppingList, "id" | "createdAt">; skipped: string[] }
  | { ok: false; error: Msg };

/**
 * Builds a list from the planned meals in [start, end] (inclusive): scale each
 * meal's ingredients to its planned servings, merge, and tag aisles. Planned dishes that have
 * no ingredients yet are left out and reported in `skipped`, so the list never silently misses one.
 */
export function generateList(
  input: { name: string; start: string; end: string; shoppedOn: string },
  recipes: Recipe[],
  days: PlanDay[],
): GenerateResult {
  const start = parseISODate(input.start);
  const end = parseISODate(input.end);
  if (!start || !end) return { ok: false, error: { key: "errPickDates" } };
  if (end < start) return { ok: false, error: { key: "errEndBefore" } };
  const range = datesInRange(input.start, input.end);
  if (range.length > MAX_LIST_RANGE_DAYS) return { ok: false, error: { key: "errRangeLong", params: { max: MAX_LIST_RANGE_DAYS } } };

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const inRange = new Set(range);
  const planned = days
    .filter((d) => inRange.has(d.date))
    .flatMap((d) => d.entries)
    .flatMap((e) => {
      const recipe = byId.get(e.recipeId);
      return recipe ? [{ servings: e.servings, recipe }] : [];
    });
  if (planned.length === 0) return { ok: false, error: { key: "errNoMeals" } };

  const skipped = [...new Set(planned.filter((m) => m.recipe.ingredients.length === 0).map((m) => m.recipe.title))];
  const meals = planned.filter((m) => m.recipe.ingredients.length > 0);
  if (meals.length === 0) return { ok: false, error: { key: "errOnlyEmptyDishes", params: { names: skipped.join(" · ") } } };

  const items: ListItem[] = buildListItems(meals).map((i) => ({ ...i, id: newId(), checked: false, price: null }));
  return {
    ok: true,
    skipped,
    list: { name: input.name.trim() || `Meals ${input.start} to ${input.end}`, rangeStart: input.start, rangeEnd: input.end, shoppedOn: input.shoppedOn, items },
  };
}

export const toggleItem = (list: ShoppingList, itemId: string, checked: boolean): ShoppingList => ({
  ...list,
  items: list.items.map((i) => (i.id === itemId ? { ...i, checked } : i)),
});
export const removeItem = (list: ShoppingList, itemId: string): ShoppingList => ({
  ...list,
  items: list.items.filter((i) => i.id !== itemId),
});
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

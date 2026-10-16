import { CATEGORIES, categorize, type Category } from "./categories";
import { massGrams, mergeIngredients, normalizeName, scaleIngredient, unitFamily, type Ingredient } from "./ingredients";

export type PlannedMeal = {
  /** Servings planned for this meal. */
  servings: number;
  recipe: { servings: number; ingredients: Ingredient[] };
};

export type ListItemDraft = Ingredient & { category: Category };

/**
 * The pure core of list generation: scale each planned meal's ingredients from
 * the recipe's servings to the planned servings, merge across meals, and tag
 * each result with its aisle.
 */
export function buildListItems(meals: PlannedMeal[]): ListItemDraft[] {
  const scaled = meals.flatMap((m) =>
    m.recipe.ingredients.map((i) =>
      scaleIngredient({ name: i.name, quantity: i.quantity, unit: i.unit }, m.recipe.servings, m.servings),
    ),
  );
  return mergeIngredients(scaled).map((i) => ({ ...i, category: categorize(i.name) }));
}

type ViewItem = { id: string; name: string; quantity: number; unit: string; checked: boolean; category: string | null };

/** Group by category in aisle order; unchecked first, then alphabetical. */
export function groupItems<T extends ViewItem>(items: T[]): { category: string; items: T[] }[] {
  const known: readonly string[] = CATEGORIES;
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category && known.includes(item.category) ? item.category : "Other";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return CATEGORIES.filter((c) => groups.has(c)).map((category) => ({
    category,
    items: groups.get(category)!.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name)),
  }));
}

export type Source = { title: string; servings: number; quantity: number; unit: string };

/** How a line of the buy list is matched to the foods that need it: same name, same kind of unit. */
export const itemKey = (name: string, unit: string) => `${normalizeName(name)}|${unitFamily(unit)}`;

/**
 * Which foods need each line of the buy list, and how much of it each one needs (scaled to the servings planned).
 * Keyed by `itemKey`. A food that lists the same ingredient twice counts once, with the amounts added up.
 */
export function sourcesByItem(meals: (PlannedMeal & { title: string })[]): Map<string, Source[]> {
  const out = new Map<string, Source[]>();
  for (const m of meals) {
    for (const i of buildListItems([m])) {
      const key = itemKey(i.name, i.unit);
      out.set(key, [...(out.get(key) ?? []), { title: m.title, servings: m.servings, quantity: i.quantity, unit: i.unit }]);
    }
  }
  return out;
}

/**
 * What one aisle needs at a glance: how many foods use it, the total weight of the items sold by weight (meat, fish),
 * and how many items have no weight (sold by count, so they are not in that total).
 */
export function aisleSummary(
  items: { name: string; quantity: number; unit: string }[],
  sourcesOf: (item: { name: string; unit: string }) => Source[],
): { dishes: number; grams: number | null; byCount: number } {
  const titles = new Set<string>();
  let grams: number | null = null;
  let byCount = 0;
  for (const i of items) {
    for (const s of sourcesOf(i)) titles.add(s.title);
    const g = massGrams(i.quantity, i.unit);
    if (g === null) byCount++;
    else grams = (grams ?? 0) + g;
  }
  return { dishes: titles.size, grams, byCount };
}

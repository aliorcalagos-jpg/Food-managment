import { CATEGORIES, categorize, type Category } from "./categories";
import { mergeIngredients, scaleIngredient, type Ingredient } from "./ingredients";

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

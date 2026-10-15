import { CATEGORIES, categorize } from "./categories";
import { db } from "./db";
import { mergeIngredients, scaleIngredient, type Ingredient } from "./ingredients";
import { addDays } from "./week";

/**
 * Build a list from the household's planned meals in [start, end] (inclusive).
 * Each recipe's ingredients are scaled from the recipe's servings to the
 * planned servings, then everything is merged. Returns null if nothing is planned.
 */
export async function generateList(householdId: string, input: { name: string; start: Date; end: Date }) {
  const entries = await db.mealPlanEntry.findMany({
    where: { householdId, date: { gte: input.start, lt: addDays(input.end, 1) } },
    include: { recipe: { include: { ingredients: true } } },
  });
  if (entries.length === 0) return null;

  const scaled: Ingredient[] = entries.flatMap((e) =>
    e.recipe.ingredients.map((i) =>
      scaleIngredient({ name: i.name, quantity: i.quantity, unit: i.unit }, e.recipe.servings, e.servings),
    ),
  );
  const items = mergeIngredients(scaled).map((i) => ({ ...i, category: categorize(i.name) }));

  return db.shoppingList.create({
    data: { householdId, name: input.name, rangeStart: input.start, rangeEnd: input.end, items: { create: items } },
    select: { id: true },
  });
}

export async function createBlankList(householdId: string, name: string) {
  return db.shoppingList.create({ data: { householdId, name }, select: { id: true } });
}

export async function listLists(householdId: string) {
  const lists = await db.shoppingList.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { checked: true } } },
  });
  return lists.map(({ items, ...l }) => ({
    ...l,
    total: items.length,
    done: items.filter((i) => i.checked).length,
  }));
}

/** Null when the list isn't in this household. */
export async function getList(householdId: string, id: string) {
  return db.shoppingList.findFirst({ where: { id, householdId }, include: { items: true } });
}

export async function addItem(householdId: string, listId: string, item: { name: string; quantity: number; unit: string }) {
  const list = await db.shoppingList.findFirst({ where: { id: listId, householdId }, select: { id: true } });
  if (!list) return null;
  return db.shoppingItem.create({
    data: { ...item, listId, category: categorize(item.name) },
    select: { id: true },
  });
}

// Item writes are filtered through the parent list so a forged item id from
// another household matches nothing.
export async function setItemChecked(householdId: string, itemId: string, checked: boolean) {
  const { count } = await db.shoppingItem.updateMany({ where: { id: itemId, list: { householdId } }, data: { checked } });
  return count > 0;
}

export async function removeItem(householdId: string, itemId: string) {
  const { count } = await db.shoppingItem.deleteMany({ where: { id: itemId, list: { householdId } } });
  return count > 0;
}

export async function clearChecked(householdId: string, listId: string) {
  const { count } = await db.shoppingItem.deleteMany({ where: { listId, checked: true, list: { householdId } } });
  return count;
}

export async function deleteList(householdId: string, listId: string) {
  const { count } = await db.shoppingList.deleteMany({ where: { id: listId, householdId } });
  return count > 0;
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

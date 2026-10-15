import { db } from "./db";
import { MEAL_TYPES, type MealTypeName } from "./meals";
import { addDays } from "./week";

const order = (m: string) => MEAL_TYPES.indexOf(m as MealTypeName);

/** Entries for the 7 days starting at `weekStart` (inclusive), in day then meal order. */
export async function getWeekPlan(householdId: string, weekStart: Date) {
  const entries = await db.mealPlanEntry.findMany({
    where: { householdId, date: { gte: weekStart, lt: addDays(weekStart, 7) } },
    include: { recipe: { select: { id: true, title: true, servings: true } } },
  });
  return entries.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || order(a.mealType) - order(b.mealType) || a.recipe.title.localeCompare(b.recipe.title),
  );
}

export type NewMeal = { date: Date; mealType: MealTypeName; recipeId: string; servings?: number };

/**
 * Returns null when the recipe isn't in this household, so a forged recipe id
 * can't pull another household's recipe into a plan.
 */
export async function addMeal(householdId: string, input: NewMeal) {
  const recipe = await db.recipe.findFirst({
    where: { id: input.recipeId, householdId },
    select: { id: true, servings: true },
  });
  if (!recipe) return null;
  return db.mealPlanEntry.create({
    data: {
      householdId,
      date: input.date,
      mealType: input.mealType,
      recipeId: recipe.id,
      servings: input.servings ?? recipe.servings,
    },
    select: { id: true },
  });
}

export async function updateMealServings(householdId: string, entryId: string, servings: number) {
  const { count } = await db.mealPlanEntry.updateMany({ where: { id: entryId, householdId }, data: { servings } });
  return count > 0;
}

export async function removeMeal(householdId: string, entryId: string) {
  const { count } = await db.mealPlanEntry.deleteMany({ where: { id: entryId, householdId } });
  return count > 0;
}

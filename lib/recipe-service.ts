import { db } from "./db";
import type { RecipeInput } from "./validation";

export type RecipeFilters = { q?: string; tag?: string };

const withIngredients = { ingredients: { orderBy: { id: "asc" as const } } };

export async function listRecipes(householdId: string, { q, tag }: RecipeFilters = {}) {
  const term = q?.trim();
  return db.recipe.findMany({
    where: {
      householdId,
      ...(tag ? { tags: { has: tag.toLowerCase() } } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { ingredients: { some: { name: { contains: term, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { title: "asc" },
    include: { _count: { select: { ingredients: true } } },
  });
}

export async function listTags(householdId: string) {
  const rows = await db.recipe.findMany({ where: { householdId }, select: { tags: true } });
  return [...new Set(rows.flatMap((r) => r.tags))].sort();
}

/** Returns null when the recipe doesn't exist *in this household*. */
export async function getRecipe(householdId: string, id: string) {
  return db.recipe.findFirst({ where: { id, householdId }, include: withIngredients });
}

export async function createRecipe(householdId: string, input: RecipeInput) {
  const { ingredients, ...rest } = input;
  return db.recipe.create({
    data: { ...rest, householdId, ingredients: { create: ingredients } },
    select: { id: true },
  });
}

/** Replaces the ingredient list. Returns null when not found in this household. */
export async function updateRecipe(householdId: string, id: string, input: RecipeInput) {
  const { ingredients, ...rest } = input;
  return db.$transaction(async (tx) => {
    const { count } = await tx.recipe.updateMany({ where: { id, householdId }, data: rest });
    if (count === 0) return null;
    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
    await tx.recipeIngredient.createMany({ data: ingredients.map((i) => ({ ...i, recipeId: id })) });
    return { id };
  });
}

export async function deleteRecipe(householdId: string, id: string) {
  const { count } = await db.recipe.deleteMany({ where: { id, householdId } });
  return count > 0;
}

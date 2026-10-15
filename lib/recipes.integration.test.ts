import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { createRecipe, deleteRecipe, getRecipe, listRecipes, listTags, updateRecipe } from "./recipe-service";
import type { RecipeInput } from "./validation";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const tag = `rt-${Date.now()}`;

const base = (over: Partial<RecipeInput> = {}): RecipeInput => ({
  title: `${tag} Pasta`,
  servings: 4,
  instructions: "Boil.",
  sourceUrl: null,
  tags: ["dinner", "quick"],
  ingredients: [
    { name: "spaghetti", quantity: 400, unit: "g" },
    { name: "garlic", quantity: 3, unit: "clove" },
  ],
  ...over,
});

run("recipe service (database)", () => {
  let a: string;
  let b: string;

  beforeAll(async () => {
    a = (await db.household.create({ data: { name: `${tag} A` } })).id;
    b = (await db.household.create({ data: { name: `${tag} B` } })).id;
  });

  afterAll(async () => {
    await db.household.deleteMany({ where: { name: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("creates and reads a recipe with ingredients in order", async () => {
    const { id } = await createRecipe(a, base());
    const r = await getRecipe(a, id);
    expect(r?.title).toBe(`${tag} Pasta`);
    expect(r?.ingredients.map((i) => i.name)).toEqual(["spaghetti", "garlic"]);
  });

  it("isolates households: no read, update or delete across them", async () => {
    const { id } = await createRecipe(a, base({ title: `${tag} Secret` }));
    expect(await getRecipe(b, id)).toBeNull();
    expect(await updateRecipe(b, id, base({ title: `${tag} Hacked` }))).toBeNull();
    expect(await deleteRecipe(b, id)).toBe(false);
    expect((await getRecipe(a, id))?.title).toBe(`${tag} Secret`);
    expect((await listRecipes(b)).map((r) => r.id)).not.toContain(id);
  });

  it("update replaces ingredients and fields", async () => {
    const { id } = await createRecipe(a, base({ title: `${tag} Edit me` }));
    await updateRecipe(a, id, base({ title: `${tag} Edited`, servings: 2, ingredients: [{ name: "rice", quantity: 1, unit: "cup" }] }));
    const r = await getRecipe(a, id);
    expect(r?.title).toBe(`${tag} Edited`);
    expect(r?.servings).toBe(2);
    expect(r?.ingredients.map((i) => i.name)).toEqual(["rice"]);
  });

  it("searches by title or ingredient, case-insensitively, and filters by tag", async () => {
    await createRecipe(a, base({ title: `${tag} Curry`, tags: ["spicy"], ingredients: [{ name: "Turmeric", quantity: 1, unit: "tsp" }] }));
    const byTitle = await listRecipes(a, { q: "CURRY" });
    expect(byTitle.some((r) => r.title === `${tag} Curry`)).toBe(true);
    const byIngredient = await listRecipes(a, { q: "turmeric" });
    expect(byIngredient.map((r) => r.title)).toContain(`${tag} Curry`);
    const byTag = await listRecipes(a, { tag: "SPICY" });
    expect(byTag.map((r) => r.title)).toEqual([`${tag} Curry`]);
    expect(await listTags(a)).toEqual(expect.arrayContaining(["dinner", "quick", "spicy"]));
    expect(await listTags(b)).toEqual([]);
  });

  it("deleting a recipe removes its ingredients", async () => {
    const { id } = await createRecipe(a, base({ title: `${tag} Gone` }));
    expect(await deleteRecipe(a, id)).toBe(true);
    expect(await db.recipeIngredient.count({ where: { recipeId: id } })).toBe(0);
  });
});

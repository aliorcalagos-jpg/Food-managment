import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { addMeal, getWeekPlan, removeMeal, updateMealServings } from "./plan-service";
import { createRecipe, deleteRecipe } from "./recipe-service";
import { parseISODate } from "./week";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const tag = `pt-${Date.now()}`;
const day = (s: string) => parseISODate(s)!;
const recipe = (title: string, servings = 4) => ({
  title: `${tag} ${title}`,
  servings,
  instructions: "",
  sourceUrl: null,
  tags: [],
  ingredients: [{ name: "x", quantity: 1, unit: "" }],
});

run("meal plan service (database)", () => {
  let a: string;
  let b: string;
  let ra: string; // recipe in household A (4 servings)
  let rb: string; // recipe in household B

  beforeAll(async () => {
    a = (await db.household.create({ data: { name: `${tag} A` } })).id;
    b = (await db.household.create({ data: { name: `${tag} B` } })).id;
    ra = (await createRecipe(a, recipe("Soup"))).id;
    rb = (await createRecipe(b, recipe("Other"))).id;
  });

  afterAll(async () => {
    await db.household.deleteMany({ where: { name: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("defaults servings to the recipe's and keeps the planned date exact", async () => {
    const { id } = (await addMeal(a, { date: day("2026-10-14"), mealType: "DINNER", recipeId: ra }))!;
    const e = await db.mealPlanEntry.findUniqueOrThrow({ where: { id } });
    expect(e.servings).toBe(4);
    expect(e.date.toISOString()).toBe("2026-10-14T00:00:00.000Z");
  });

  it("refuses a recipe from another household", async () => {
    expect(await addMeal(a, { date: day("2026-10-14"), mealType: "LUNCH", recipeId: rb })).toBeNull();
    expect(await db.mealPlanEntry.count({ where: { recipeId: rb } })).toBe(0);
  });

  it("returns a Monday-Sunday week inclusive, excluding neighbours, ordered by day then meal", async () => {
    const c = (await db.household.create({ data: { name: `${tag} C` } })).id;
    const rc = (await createRecipe(c, recipe("C soup"))).id;
    const add = (date: string, mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK") =>
      addMeal(c, { date: day(date), mealType, recipeId: rc });
    await add("2026-10-11", "DINNER"); // Sunday before
    await add("2026-10-19", "BREAKFAST"); // Monday after
    await add("2026-10-18", "SNACK"); // Sunday, last day of the week
    await add("2026-10-12", "DINNER"); // Monday, first day
    await add("2026-10-12", "BREAKFAST");
    const plan = await getWeekPlan(c, day("2026-10-12"));
    expect(plan.map((e) => `${e.date.toISOString().slice(0, 10)} ${e.mealType}`)).toEqual([
      "2026-10-12 BREAKFAST",
      "2026-10-12 DINNER",
      "2026-10-18 SNACK",
    ]);
  });

  it("scopes plans, updates and removals by household", async () => {
    const { id } = (await addMeal(a, { date: day("2026-11-02"), mealType: "DINNER", recipeId: ra, servings: 2 }))!;
    expect(await getWeekPlan(b, day("2026-11-02"))).toEqual([]);
    expect(await updateMealServings(b, id, 9)).toBe(false);
    expect(await removeMeal(b, id)).toBe(false);
    expect((await db.mealPlanEntry.findUniqueOrThrow({ where: { id } })).servings).toBe(2);
    expect(await updateMealServings(a, id, 6)).toBe(true);
    expect((await db.mealPlanEntry.findUniqueOrThrow({ where: { id } })).servings).toBe(6);
    expect(await removeMeal(a, id)).toBe(true);
  });

  it("allows several recipes in one slot, and deleting a recipe removes it from the plan", async () => {
    const r2 = (await createRecipe(a, recipe("Bread"))).id;
    await addMeal(a, { date: day("2026-12-07"), mealType: "DINNER", recipeId: ra });
    await addMeal(a, { date: day("2026-12-07"), mealType: "DINNER", recipeId: r2 });
    expect(await getWeekPlan(a, day("2026-12-07"))).toHaveLength(2);
    await deleteRecipe(a, r2);
    const left = await getWeekPlan(a, day("2026-12-07"));
    expect(left).toHaveLength(1);
    expect(left[0].recipeId).toBe(ra);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  addItem, clearChecked, createBlankList, deleteList, generateList, getList, listLists, removeItem, setItemChecked,
} from "./list-service";
import { addMeal } from "./plan-service";
import { createRecipe } from "./recipe-service";
import { parseISODate } from "./week";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const tag = `lt-${Date.now()}`;
const day = (s: string) => parseISODate(s)!;

run("shopping lists (database)", () => {
  let a: string;
  let b: string;
  let pasta: string; // 4 servings: 400 g spaghetti, 2 cup milk, 3 tomatoes
  let bake: string; // 2 servings: 1 kg spaghetti, 1 cup milk

  beforeAll(async () => {
    a = (await db.household.create({ data: { name: `${tag} A` } })).id;
    b = (await db.household.create({ data: { name: `${tag} B` } })).id;
    const base = { instructions: "", sourceUrl: null, tags: [] };
    pasta = (
      await createRecipe(a, {
        ...base, title: `${tag} Pasta`, servings: 4,
        ingredients: [
          { name: "Spaghetti", quantity: 400, unit: "g" },
          { name: "milk", quantity: 2, unit: "cup" },
          { name: "tomatoes", quantity: 3, unit: "" },
        ],
      })
    ).id;
    bake = (
      await createRecipe(a, {
        ...base, title: `${tag} Bake`, servings: 2,
        ingredients: [
          { name: "spaghetti", quantity: 1, unit: "kg" },
          { name: "milk", quantity: 1, unit: "cup" },
        ],
      })
    ).id;
  });

  afterAll(async () => {
    await db.household.deleteMany({ where: { name: { startsWith: tag } } });
    await db.$disconnect();
  });

  const items = async (id: string) =>
    Object.fromEntries((await getList(a, id))!.items.map((i) => [i.name, `${i.quantity} ${i.unit}`.trim()]));

  it("scales to planned servings, merges across recipes, keeps units, and categorises", async () => {
    // Pasta planned for 2 (half the recipe): 200 g spaghetti, 1 cup milk, 1.5 tomatoes
    await addMeal(a, { date: day("2027-03-01"), mealType: "DINNER", recipeId: pasta, servings: 2 });
    // Pasta again at its own 4 servings: 400 g, 2 cup, 3 tomatoes
    await addMeal(a, { date: day("2027-03-03"), mealType: "DINNER", recipeId: pasta });
    // Bake for 2 (as written): 1 kg spaghetti, 1 cup milk
    await addMeal(a, { date: day("2027-03-07"), mealType: "DINNER", recipeId: bake });
    // Outside the range, must not count
    await addMeal(a, { date: day("2027-03-08"), mealType: "DINNER", recipeId: bake });
    await addMeal(a, { date: day("2027-02-28"), mealType: "DINNER", recipeId: bake });

    const { id } = (await generateList(a, { name: `${tag} Week`, start: day("2027-03-01"), end: day("2027-03-07") }))!;
    const got = await items(id);
    // spaghetti: 200 g + 400 g + 1 kg = 1600 g -> 1.6 kg (mixed units go to the largest with >= 1)
    expect(got.spaghetti).toBe("1.6 kg");
    // milk: 1 + 2 + 1 = 4 cup, unit kept as written
    expect(got.milk).toBe("4 cup");
    // tomatoes: 1.5 + 3 = 4.5, shown as written, not singularised
    expect(got.tomatoes).toBe("4.5");

    const list = (await getList(a, id))!;
    const cat = Object.fromEntries(list.items.map((i) => [i.name, i.category]));
    expect(cat).toEqual({ spaghetti: "Pantry", milk: "Dairy & eggs", tomatoes: "Produce" });
    expect(list.rangeStart?.toISOString()).toBe("2027-03-01T00:00:00.000Z");
    expect(list.items.every((i) => !i.checked)).toBe(true);
  });

  it("includes both ends of the range", async () => {
    const { id } = (await generateList(a, { name: `${tag} Edge`, start: day("2027-03-07"), end: day("2027-03-08") }))!;
    // Mar 7 and Mar 8 both have the bake: 2 x (1 kg, 1 cup)
    expect(await items(id)).toEqual({ spaghetti: "2 kg", milk: "2 cup" });
  });

  it("returns null when nothing is planned in the range", async () => {
    expect(await generateList(a, { name: `${tag} Empty`, start: day("2030-01-01"), end: day("2030-01-07") })).toBeNull();
  });

  it("only uses the caller's own plan", async () => {
    expect(await generateList(b, { name: `${tag} B list`, start: day("2027-03-01"), end: day("2027-03-07") })).toBeNull();
  });

  it("manual items, checking, removing and clearing", async () => {
    const { id } = await createBlankList(a, `${tag} Manual`);
    const milk = (await addItem(a, id, { name: "Oat milk", quantity: 1, unit: "l" }))!;
    const soap = (await addItem(a, id, { name: "Soap", quantity: 2, unit: "" }))!;
    await addItem(a, id, { name: "Bananas", quantity: 6, unit: "" });
    expect(await addItem(a, "no-such-list", { name: "x", quantity: 1, unit: "" })).toBeNull();

    expect(await setItemChecked(a, milk.id, true)).toBe(true);
    expect(await setItemChecked(a, soap.id, true)).toBe(true);
    const lists = await listLists(a);
    expect(lists.find((l) => l.id === id)).toMatchObject({ total: 3, done: 2 });

    expect(await clearChecked(a, id)).toBe(2);
    expect((await getList(a, id))!.items.map((i) => i.name)).toEqual(["Bananas"]);
    const [left] = (await getList(a, id))!.items;
    expect(left.category).toBe("Produce");
    expect(await removeItem(a, left.id)).toBe(true);
    expect(await deleteList(a, id)).toBe(true);
    expect(await getList(a, id)).toBeNull();
  });

  it("isolates households for every item and list operation", async () => {
    const { id } = await createBlankList(a, `${tag} Private`);
    const item = (await addItem(a, id, { name: "Secret", quantity: 1, unit: "" }))!;
    expect(await getList(b, id)).toBeNull();
    expect(await addItem(b, id, { name: "Intruder", quantity: 1, unit: "" })).toBeNull();
    expect(await setItemChecked(b, item.id, true)).toBe(false);
    expect(await removeItem(b, item.id)).toBe(false);
    expect(await clearChecked(b, id)).toBe(0);
    expect(await deleteList(b, id)).toBe(false);
    expect((await listLists(b)).map((l) => l.id)).not.toContain(id);
    const after = (await getList(a, id))!;
    expect(after.items).toHaveLength(1);
    expect(after.items[0].checked).toBe(false);
  });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { openArtifact, stored } from "./harness";

const TODAY = "2026-10-14"; // a Wednesday, so the week is Mon Oct 12 - Sun Oct 18

async function addRecipe(page: Page, title: string, servings: string, ings: [string, string, string][]) {
  await page.getByRole("button", { name: "New recipe" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Servings", { exact: true }).fill(servings);
  for (const [i, [qty, unit, name]] of ings.entries()) {
    if (i > 0) await page.getByRole("button", { name: "+ Add ingredient" }).click();
    await page.getByLabel(`Quantity ${i + 1}`, { exact: true }).fill(qty);
    await page.getByLabel(`Unit ${i + 1}`, { exact: true }).fill(unit);
    await page.getByLabel(`Ingredient ${i + 1}`, { exact: true }).fill(name);
  }
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

const slot = (day: Locator, meal: string) => day.locator(".slot", { has: day.page().getByRole("heading", { name: meal, exact: true }) });

async function plan(page: Page, dayName: string, recipe: string, servings?: string) {
  const row = slot(page.getByRole("region", { name: dayName }), "Dinner");
  await row.getByRole("button", { name: "Add a recipe" }).click();
  await row.getByRole("combobox").selectOption({ label: recipe });
  if (servings) await row.getByPlaceholder("servings").fill(servings);
  await row.getByRole("button", { name: "Add", exact: true }).click();
  await expect(row.getByText(recipe, { exact: true })).toBeVisible();
}

test("recipes, planner and shopping list end to end", async ({ page }) => {
  const { blocked } = await openArtifact(page, { today: TODAY });

  // designed empty state, then validation that keeps what was typed
  await expect(page.getByText("No recipes yet")).toBeVisible();
  await page.getByRole("button", { name: "New recipe" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Pasta");
  await page.getByLabel("Quantity 1", { exact: true }).fill("lots");
  await page.getByLabel("Ingredient 1", { exact: true }).fill("spaghetti");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByText(/Check the quantity for "spaghetti"/)).toBeVisible();
  await expect(page.getByLabel("Ingredient 1", { exact: true })).toHaveValue("spaghetti");
  await page.getByLabel("Source link (optional)").fill("javascript:alert(1)");
  await page.getByLabel("Quantity 1", { exact: true }).fill("400");
  await page.getByLabel("Unit 1", { exact: true }).fill("g");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByText("Enter a valid http(s) link")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await addRecipe(page, "Pasta", "4", [["400", "g", "spaghetti"], ["2", "cup", "milk"], ["3", "", "tomatoes"]]);
  await page.getByRole("button", { name: "← All recipes" }).click();
  await addRecipe(page, "Bake", "2", [["1", "kg", "spaghetti"]]);
  await page.getByRole("button", { name: "← All recipes" }).click();

  // search by ingredient, then by title, with clear filters
  await page.getByLabel("Search recipes").fill("MILK");
  await expect(page.getByRole("button", { name: /Pasta/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bake/ })).toHaveCount(0);
  await page.getByLabel("Search recipes").fill("zzz");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("button", { name: /Bake/ })).toBeVisible();

  // planner: fixed week, today marked, explicit and default servings
  await page.getByRole("button", { name: "Planner" }).click();
  await expect(page.getByText("Oct 12 – Oct 18, 2026")).toBeVisible();
  await expect(page.getByRole("region", { name: "Wednesday, Oct 14" }).getByText("Today")).toBeVisible();
  await plan(page, "Monday, Oct 12", "Pasta", "2"); // half: 200 g, 1 cup, 1.5 tomatoes
  await plan(page, "Wednesday, Oct 14", "Pasta"); // as written (4)
  await plan(page, "Friday, Oct 16", "Bake"); // 1 kg
  await expect(slot(page.getByRole("region", { name: "Wednesday, Oct 14" }), "Dinner").getByLabel("Servings for Pasta")).toHaveValue("4");

  // editing servings persists
  const monDinner = slot(page.getByRole("region", { name: "Monday, Oct 12" }), "Dinner");
  await monDinner.getByLabel("Servings for Pasta").fill("2");
  await monDinner.getByLabel("Servings for Pasta").press("Enter");

  // generate the list (defaults to the current week)
  await page.getByRole("button", { name: "Lists" }).click();
  await page.getByRole("button", { name: "Generate from meal plan" }).click();
  await expect(page.getByLabel("1.6 kg spaghetti")).toBeVisible(); // 200 g + 400 g + 1 kg
  await expect(page.getByLabel("3 cup milk")).toBeVisible(); // 1 + 2, unit kept
  await expect(page.getByLabel("4 1/2 tomatoes")).toBeVisible(); // 1.5 + 3
  await expect(page.getByText("0 of 3 done")).toBeVisible();
  expect(await page.getByRole("region").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(["Produce", "Dairy & eggs", "Pantry"]);

  // two quick ticks must both land (writes are computed from the latest state)
  // (slow saves, so the second tap lands while the first is still being written)
  const setDelay = (ms: number) => page.evaluate((n) => ((window as unknown as { __writeDelay: number }).__writeDelay = n), ms);
  await setDelay(300);
  await page.getByLabel("3 cup milk").check();
  await page.getByLabel("4 1/2 tomatoes").check();
  await expect(page.getByText("2 of 3 done")).toBeVisible();
  await setDelay(15);
  await page.reload();
  await page.getByRole("button", { name: /^Meals/ }).click();
  await expect(page.getByLabel("3 cup milk")).toBeChecked();
  await expect(page.getByLabel("4 1/2 tomatoes")).toBeChecked();
  await expect(page.getByLabel("1.6 kg spaghetti")).not.toBeChecked();

  // manual items: validation keeps input, fraction works, default quantity is 1
  await page.getByLabel("Item name").fill("paper towels");
  await page.getByLabel("Quantity", { exact: true }).fill("lots");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Use a number like 2, 0.5 or 1/2.")).toBeVisible();
  await expect(page.getByLabel("Item name")).toHaveValue("paper towels");
  await page.getByLabel("Quantity", { exact: true }).fill("");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("1 paper towels")).toBeVisible();
  await expect(page.getByRole("region", { name: "Other" })).toBeVisible();
  await page.getByRole("button", { name: "Remove paper towels" }).click();
  await expect(page.getByLabel("1 paper towels")).toHaveCount(0);

  // clear checked uses an inline confirmation (the viewer has no confirm())
  await page.getByRole("button", { name: "Clear 2 checked items" }).click();
  await page.getByRole("button", { name: "Remove checked items" }).click();
  await expect(page.getByLabel("3 cup milk")).toHaveCount(0);
  await expect(page.getByLabel("1.6 kg spaghetti")).toBeVisible();

  // deleting a recipe also removes its planned meals; the list already made is untouched
  await page.getByRole("button", { name: "Recipes" }).click();
  await page.getByRole("button", { name: /Bake/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete recipe and its planned meals" }).click();
  await expect(page.getByText("Bake")).toHaveCount(0);
  await page.getByRole("button", { name: "Planner" }).click();
  await expect(page.getByRole("region", { name: "Friday, Oct 16" }).getByText("Bake")).toHaveCount(0);
  expect((await stored(page, "plan")).map((d) => (d.entries as unknown[]).length)).toEqual([1, 1]); // Mon, Wed. Friday's doc is gone.

  // the db contract: never two writes to one document at once, nothing external loaded
  expect(await page.evaluate(() => (window as unknown as { __overlaps: number }).__overlaps)).toBe(0);
  expect(blocked).toEqual([]);
});

test("a failed save shows an error instead of silently losing the change", async ({ page }) => {
  await openArtifact(page, { today: TODAY });
  await page.evaluate(() => ((window as unknown as { __failWrites: boolean }).__failWrites = true));
  await page.getByRole("button", { name: "New recipe" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Soup");
  await page.getByLabel("Quantity 1", { exact: true }).fill("1");
  await page.getByLabel("Ingredient 1", { exact: true }).fill("leek");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't save that" })).toBeVisible();
  // the form stays open with what was typed, and nothing was stored or shown as saved
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Soup");
  expect(await stored(page, "recipes")).toEqual([]);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't save that" })).toHaveCount(0);

  // once the connection is back, the same form saves
  await page.evaluate(() => ((window as unknown as { __failWrites: boolean }).__failWrites = false));
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: "Soup" })).toBeVisible();
  expect((await stored(page, "recipes")).map((r) => r.title)).toEqual(["Soup"]);
});

test("explains itself when storage is unavailable", async ({ page }) => {
  await openArtifact(page, { noDb: true });
  await expect(page.getByText("Your recipes can't be opened right now")).toBeVisible();
  await expect(page.getByRole("button", { name: "New recipe" })).toHaveCount(0);
});

test("example recipes can be removed together with their planned meals", async ({ page }) => {
  await openArtifact(page, {
    today: TODAY,
    seed: {
      recipes: {
        ex1: { title: "Example soup", servings: 2, tags: ["example"], instructions: "", sourceUrl: null, ingredients: [{ name: "leek", quantity: 1, unit: "" }] },
        mine: { title: "My own dish", servings: 2, tags: [], instructions: "", sourceUrl: null, ingredients: [{ name: "rice", quantity: 1, unit: "cup" }] },
      },
      plan: { "2026-10-14": { entries: [{ id: "a", mealType: "DINNER", recipeId: "ex1", servings: 2 }, { id: "b", mealType: "DINNER", recipeId: "mine", servings: 2 }] } },
    },
  });
  await expect(page.getByText("These are example recipes")).toBeVisible();
  await page.getByRole("button", { name: "Remove examples" }).click();
  await page.getByRole("button", { name: "Remove all examples" }).click();
  await expect(page.getByText("These are example recipes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Example soup/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /My own dish/ })).toBeVisible();
  expect((await stored(page, "plan"))[0].entries).toEqual([{ id: "b", mealType: "DINNER", recipeId: "mine", servings: 2 }]);
});

import { expect, test, type Page } from "@playwright/test";
import { openArtifact, stored } from "./harness";

const TODAY = "2026-10-14"; // a Wednesday, so the week is Mon Oct 12 - Sun Oct 18

/** Adds a food through the ingredient sheet: type each line, Enter, then Done. */
async function addRecipe(page: Page, title: string, servings: string, ings: [string, string, string][]) {
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  for (let n = 1; n < Number(servings); n++) await page.getByRole("button", { name: "More servings" }).click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  for (const [qty, unit, name] of ings) {
    await page.getByLabel("Type an ingredient").fill([qty, unit, name].filter(Boolean).join(" "));
    await page.getByLabel("Type an ingredient").press("Enter");
  }
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

const buyPanel = (page: Page) => page.getByRole("complementary");
const foodRow = (page: Page, title: string) => page.getByRole("button", { name: title, exact: true });

test("recipes, this week and shopping list end to end", async ({ page }) => {
  const { blocked } = await openArtifact(page, { today: TODAY });

  // designed empty state, then validation that keeps what was typed
  await expect(page.getByText("No recipes yet")).toBeVisible();
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Pasta");
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Type an ingredient").fill("lots spaghetti"); // no number: nothing can be added until a quantity is given
  await expect(page.getByText("Add a quantity")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  await page.getByLabel("Type an ingredient").fill("400 g spaghetti");
  await page.getByLabel("Type an ingredient").press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("More details", { exact: false }).click();
  await page.getByLabel("Source link (optional)").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByText("Enter a valid http(s) link")).toBeVisible();
  await expect(page.getByRole("button", { name: /400 g spaghetti/ })).toBeVisible(); // what was typed is kept
  await page.getByRole("button", { name: "Cancel" }).click();

  await addRecipe(page, "Pasta", "4", [["400", "g", "spaghetti"], ["2", "cup", "milk"], ["3", "", "tomatoes"]]);
  await page.getByRole("button", { name: "All recipes" }).click();
  await addRecipe(page, "Bake", "2", [["1", "kg", "spaghetti"]]);
  await page.getByRole("button", { name: "All recipes" }).click();

  // search by ingredient, then by title, with clear filters
  await page.getByLabel("Search recipes").fill("MILK");
  await expect(page.getByRole("button", { name: /Pasta/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bake/ })).toHaveCount(0);
  await page.getByLabel("Search recipes").fill("zzz");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("button", { name: /Bake/ })).toBeVisible();

  // this week: fixed week, nothing chosen yet
  await page.getByRole("button", { name: "This week", exact: true }).first().click();
  await expect(page.getByText("Oct 12 – Oct 18, 2026")).toBeVisible();
  await expect(buyPanel(page).getByText("Tap a food to see what you need to buy.")).toBeVisible();
  await expect(buyPanel(page).getByRole("button", { name: "Start shopping" })).toBeDisabled();

  // tapping a food adds it at once, at the servings its recipe makes
  await foodRow(page, "Pasta").click();
  await expect(foodRow(page, "Pasta")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Recipe makes 4")).toBeVisible();
  await expect(buyPanel(page).getByText("400 g spaghetti")).toBeVisible();
  // more servings scale everything: 6 of a 4-serving recipe
  await page.getByRole("button", { name: "More servings of Pasta" }).click();
  await page.getByRole("button", { name: "More servings of Pasta" }).click();
  await expect(buyPanel(page).getByText("600 g spaghetti")).toBeVisible();
  await foodRow(page, "Bake").click(); // 1 kg
  await expect(buyPanel(page).getByText("1.6 kg spaghetti")).toBeVisible(); // 600 g + 1 kg
  await expect(buyPanel(page).getByText("3 cup milk")).toBeVisible();
  await expect(buyPanel(page).getByText("4 1/2 tomatoes")).toBeVisible();
  await expect(buyPanel(page).getByText("3 items")).toBeVisible();
  expect(await buyPanel(page).getByRole("region").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(["Produce", "Dairy & eggs", "Pantry"]);
  await expect.poll(async () => (await stored(page, "week"))[0]?.picks).toEqual([{ recipeId: expect.any(String), servings: 6 }, { recipeId: expect.any(String), servings: 2 }]);

  // untapping takes it off the list at once
  await foodRow(page, "Bake").click();
  await expect(buyPanel(page).getByText("600 g spaghetti")).toBeVisible();
  await foodRow(page, "Bake").click();

  // start shopping: a list is saved and opened
  await buyPanel(page).getByRole("button", { name: "Start shopping" }).click();
  await expect(page.getByRole("heading", { name: "Shopping 2026-10-14" })).toBeVisible();
  await expect(page.getByLabel("1.6 kg spaghetti")).toBeVisible();
  await expect(page.getByLabel("3 cup milk")).toBeVisible();
  await expect(page.getByLabel("4 1/2 tomatoes")).toBeVisible();
  await expect(page.getByText("0 of 3 done")).toBeVisible();
  expect(await page.getByRole("region").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(["Produce", "Dairy & eggs", "Pantry"]);

  // two quick ticks must both land (writes are computed from the latest state)
  // (slow saves, so the second tap lands while the first is still being written)
  const setDelay = (ms: number) => page.evaluate((n) => ((window as unknown as { __writeDelay: number }).__writeDelay = n), ms);
  await setDelay(300);
  await page.getByLabel("3 cup milk").check();
  await page.getByLabel("4 1/2 tomatoes").check();
  await expect(page.getByText("2 of 3 done")).toBeVisible();
  // the screen updates at once; wait for the (slow) saves to land before reloading, or the reload would drop them
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { checked: boolean }[]).filter((i) => i.checked).length).toBe(2);
  await setDelay(15);
  await page.reload();
  await page.getByRole("button", { name: /^Shopping 2026/ }).click();
  await expect(page.getByLabel("3 cup milk")).toBeChecked();
  await expect(page.getByLabel("4 1/2 tomatoes")).toBeChecked();
  await expect(page.getByLabel("1.6 kg spaghetti")).not.toBeChecked();

  // manual items: validation keeps input, fraction works, default quantity is 1
  await page.getByLabel("Add an item").fill("500000 paper towels");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Use a number like 2, 0.5 or 1/2.")).toBeVisible();
  await expect(page.getByLabel("Add an item")).toHaveValue("500000 paper towels");
  await page.getByLabel("Add an item").fill("paper towels");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("1 paper towels")).toBeVisible();
  await expect(page.getByRole("region", { name: "Other" })).toBeVisible();
  await page.getByRole("button", { name: "Remove paper towels" }).click();
  await expect(page.getByLabel("1 paper towels")).toHaveCount(0);

  // clear checked uses an inline confirmation (the viewer has no confirm())
  await page.getByText("More", { exact: true }).click();
  await page.getByRole("button", { name: "Clear 2 checked items" }).click();
  await page.getByRole("button", { name: "Remove checked items" }).click();
  await expect(page.getByLabel("3 cup milk")).toHaveCount(0);
  await expect(page.getByLabel("1.6 kg spaghetti")).toBeVisible();

  // deleting a recipe also takes it off the week; the list already made is untouched
  await page.getByRole("button", { name: "Foods", exact: true }).click();
  await page.getByRole("button", { name: /Bake/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete recipe and take it off the week" }).click();
  await expect(page.getByText("Bake")).toHaveCount(0);
  await page.getByRole("button", { name: "This week", exact: true }).first().click();
  await expect(foodRow(page, "Bake")).toHaveCount(0);
  await expect.poll(async () => ((await stored(page, "week"))[0].picks as { servings: number }[]).map((p) => p.servings)).toEqual([6]);
  expect((await stored(page, "lists"))).toHaveLength(1);

  // the db contract: never two writes to one document at once, nothing external loaded
  expect(await page.evaluate(() => (window as unknown as { __overlaps: number }).__overlaps)).toBe(0);
  expect(blocked).toEqual([]);
});

test("a failed save shows an error instead of silently losing the change", async ({ page }) => {
  await openArtifact(page, { today: TODAY });
  await page.evaluate(() => ((window as unknown as { __failWrites: boolean }).__failWrites = true));
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Soup");
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Type an ingredient").fill("1 leek");
  await page.getByLabel("Type an ingredient").press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).click();
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
  await expect(page.getByRole("button", { name: "New food" })).toHaveCount(0);
});

test("example recipes can be removed, and come off the week too", async ({ page }) => {
  await openArtifact(page, {
    today: TODAY,
    seed: {
      recipes: {
        ex1: { title: "Example soup", servings: 2, tags: ["example"], instructions: "", sourceUrl: null, ingredients: [{ name: "leek", quantity: 1, unit: "" }] },
        mine: { title: "My own dish", servings: 2, tags: [], instructions: "", sourceUrl: null, ingredients: [{ name: "rice", quantity: 1, unit: "cup" }] },
      },
      week: { "2026-10-12": { picks: [{ recipeId: "ex1", servings: 2 }, { recipeId: "mine", servings: 2 }], listId: null } },
    },
  });
  await expect(page.getByText("These are example recipes")).toBeVisible();
  await page.getByRole("button", { name: "Remove examples" }).click();
  await page.getByRole("button", { name: "Remove all examples" }).click();
  await expect(page.getByText("These are example recipes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Example soup/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /My own dish/ })).toBeVisible();
  expect((await stored(page, "week"))[0].picks).toEqual([{ recipeId: "mine", servings: 2 }]);
});

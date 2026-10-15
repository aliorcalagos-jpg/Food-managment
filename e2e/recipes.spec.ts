import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, signupAndCreateHousehold, resetLoopbackRateLimits } from "./helpers";

const tag = `e2er-${Date.now()}`;
test.beforeAll(resetLoopbackRateLimits);
test.afterAll(() => cleanup(tag));

async function addIngredient(page: Page, i: number, qty: string, unit: string, name: string) {
  if (i > 1) await page.getByRole("button", { name: "+ Add ingredient" }).click();
  await page.getByLabel(`Quantity ${i}`, { exact: true }).fill(qty);
  await page.getByLabel(`Unit ${i}`, { exact: true }).fill(unit);
  await page.getByLabel(`Ingredient ${i}`, { exact: true }).fill(name);
}

test("recipe CRUD, search, tags and household isolation", async ({ page, browser }) => {
  await signupAndCreateHousehold(page, tag, "Ann");
  await expect(page.getByText("No recipes yet")).toBeVisible();

  // validation keeps what was typed
  await page.getByRole("link", { name: "New recipe" }).click();
  await page.getByLabel("Title", { exact: true }).fill(`${tag} Lentil soup`);
  await addIngredient(page, 1, "lots", "", "lentils");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByText(/Check the quantity for "lentils"/)).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`${tag} Lentil soup`);
  await expect(page.getByLabel("Ingredient 1", { exact: true })).toHaveValue("lentils");

  // unsafe source link is rejected
  await page.getByLabel("Quantity 1", { exact: true }).fill("1 1/2");
  await page.getByLabel("Unit 1", { exact: true }).fill("cup");
  await addIngredient(page, 2, "1/3", "cup", "olive oil");
  await page.getByLabel("Tags (comma separated)").fill("Dinner, Vegan");
  await page.getByLabel("Instructions").fill("Simmer.\nServe.");
  await page.getByLabel("Source link (optional)").evaluate((el: HTMLInputElement) => (el.type = "text"));
  await page.getByLabel("Source link (optional)").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByText("Enter a valid http(s) link")).toBeVisible();

  await page.getByLabel("Source link (optional)").fill("https://example.com/soup");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: `${tag} Lentil soup` })).toBeVisible();
  await expect(page.getByText("1 1/2 cup lentils")).toBeVisible();
  await expect(page.getByText("1/3 cup olive oil")).toBeVisible();
  await expect(page.getByRole("link", { name: "Source" })).toHaveAttribute("href", "https://example.com/soup");
  const recipeUrl = page.url();

  // second recipe, then search + tag filter
  await page.goto("/recipes/new");
  await page.getByLabel("Title", { exact: true }).fill(`${tag} Pancakes`);
  await addIngredient(page, 1, "2", "cup", "flour");
  await page.getByLabel("Tags (comma separated)").fill("breakfast");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: `${tag} Pancakes` })).toBeVisible();

  await page.goto("/recipes");
  await expect(page.getByRole("link", { name: /Lentil soup/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pancakes/ })).toBeVisible();
  await page.getByLabel("Search recipes").fill("FLOUR");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: /Pancakes/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Lentil soup/ })).toHaveCount(0);
  await page.goto("/recipes");
  await page.getByRole("link", { name: "vegan", exact: true }).click();
  await expect(page.getByRole("link", { name: /Lentil soup/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pancakes/ })).toHaveCount(0);

  // edit keeps fractions intact
  await page.goto(`${recipeUrl}/edit`);
  await expect(page.getByLabel("Quantity 1", { exact: true })).toHaveValue("1 1/2");
  await expect(page.getByLabel("Quantity 2", { exact: true })).toHaveValue("1/3");
  await page.getByLabel("Title", { exact: true }).fill(`${tag} Red lentil soup`);
  await page.getByRole("button", { name: "Remove ingredient 1" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: `${tag} Red lentil soup` })).toBeVisible();
  await expect(page.getByText("1/3 cup olive oil")).toBeVisible();
  await expect(page.getByText("lentils")).toHaveCount(0);

  // another household can't see, edit or delete it
  const other = await browser.newContext();
  const o = await other.newPage();
  await signupAndCreateHousehold(o, tag, "Eve");
  for (const url of [recipeUrl, `${recipeUrl}/edit`]) {
    await o.goto(url);
    const html = await o.content();
    // what matters is that nothing from Ann's recipe reaches Eve
    expect(html).not.toContain("Red lentil soup");
    expect(html).not.toContain("olive oil");
    await expect(o.getByText(/could not be found/i)).toBeVisible();
  }
  await o.goto("/recipes");
  await expect(o.getByText("No recipes yet")).toBeVisible();
  await other.close();

  // delete
  await page.goto(recipeUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole("link", { name: /Red lentil soup/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Pancakes/ })).toBeVisible();
});

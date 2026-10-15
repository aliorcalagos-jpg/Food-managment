import "dotenv/config";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanup, signupAndCreateHousehold } from "./helpers";

const tag = `e2ep-${Date.now()}`;
const WEEK = "/planner?week=2026-10-14"; // a Wednesday: should resolve to Mon Oct 12
test.afterAll(() => cleanup(tag));

const day = (page: Page, name: string) => page.getByRole("region", { name });
const slot = (section: Locator, meal: string) =>
  section.locator("div.grid", { has: section.page().getByRole("heading", { name: meal, exact: true }) });

async function addRecipe(page: Page, title: string, servings: string) {
  await page.goto("/recipes/new");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Servings", { exact: true }).fill(servings);
  await page.getByLabel("Quantity 1", { exact: true }).fill("1");
  await page.getByLabel("Ingredient 1", { exact: true }).fill("salt");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return page.url();
}

async function planMeal(section: Locator, meal: string, recipe: string, servings?: string) {
  const row = slot(section, meal);
  await row.getByText("Add a recipe").click();
  await row.getByRole("combobox").selectOption({ label: recipe });
  if (servings) await row.getByPlaceholder("servings").fill(servings);
  await row.getByRole("button", { name: "Add" }).click();
}

test("plan meals across a week", async ({ page, browser }) => {
  await signupAndCreateHousehold(page, tag, "Ann");

  // no recipes yet
  await page.goto(WEEK);
  await expect(page.getByText("You need a recipe before you can plan meals")).toBeVisible();

  const soupUrl = await addRecipe(page, `${tag} Soup`, "4");
  await addRecipe(page, `${tag} Toast`, "2");

  // week resolves to Monday..Sunday
  await page.goto(WEEK);
  await expect(page.getByText("Oct 12 – Oct 18, 2026")).toBeVisible();
  await expect(page.getByRole("region")).toHaveCount(7);
  await expect(page.getByRole("region").first()).toHaveAccessibleName("Monday, Oct 12");
  await expect(page.getByRole("region").last()).toHaveAccessibleName("Sunday, Oct 18");

  // explicit servings, and default servings from the recipe
  const wed = day(page, "Wednesday, Oct 14");
  await planMeal(wed, "Dinner", `${tag} Soup`, "6");
  await expect(slot(wed, "Dinner").getByRole("link", { name: `${tag} Soup` })).toBeVisible();
  await expect(slot(wed, "Dinner").getByRole("spinbutton", { name: `Servings for ${tag} Soup` })).toHaveValue("6");

  const mon = day(page, "Monday, Oct 12");
  await planMeal(mon, "Breakfast", `${tag} Toast`);
  await expect(slot(mon, "Breakfast").getByRole("spinbutton", { name: `Servings for ${tag} Toast` })).toHaveValue("2");

  // the Sunday edge of the week
  const sun = day(page, "Sunday, Oct 18");
  await planMeal(sun, "Snack", `${tag} Toast`, "1");
  await expect(slot(sun, "Snack").getByRole("link", { name: `${tag} Toast` })).toBeVisible();

  // edit servings, persists after reload
  const dinner = slot(wed, "Dinner");
  await dinner.getByRole("spinbutton", { name: `Servings for ${tag} Soup` }).fill("3");
  await dinner.getByRole("button", { name: "Update" }).click();
  await page.reload();
  await expect(slot(day(page, "Wednesday, Oct 14"), "Dinner").getByRole("spinbutton")).toHaveValue("3");

  // week navigation: entries are per week
  await page.getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(/week=2026-10-19/);
  await expect(page.getByText("Oct 19 – Oct 25, 2026")).toBeVisible();
  await expect(page.getByRole("link", { name: `${tag} Soup` })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "This week" })).toBeVisible();
  await page.getByRole("link", { name: "← Previous" }).click();
  await expect(page.getByRole("link", { name: `${tag} Soup` })).toBeVisible();

  // garbage week values fall back to the current week instead of erroring
  for (const bad of ["nonsense", "2026-02-30", ""]) {
    const res = await page.goto(`/planner?week=${bad}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Meal planner" })).toBeVisible();
    await expect(page.getByRole("region")).toHaveCount(7);
  }

  // another household sees an empty plan
  const other = await browser.newContext();
  const o = await other.newPage();
  await signupAndCreateHousehold(o, tag, "Eve");
  await o.goto(WEEK);
  await expect(o.getByRole("link", { name: `${tag} Soup` })).toHaveCount(0);
  await other.close();

  // remove one entry
  await page.goto(WEEK);
  await slot(day(page, "Monday, Oct 12"), "Breakfast").getByRole("button", { name: /^Remove/ }).click();
  await expect(page.getByRole("link", { name: `${tag} Toast` })).toHaveCount(1); // only the Sunday snack is left

  // deleting a recipe takes it out of the plan
  await page.goto(soupUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await page.goto(WEEK);
  await expect(page.getByRole("link", { name: `${tag} Soup` })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `${tag} Toast` })).toHaveCount(1);
});

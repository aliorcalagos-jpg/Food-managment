import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { addRecipe, cleanup, signupAndCreateHousehold } from "./helpers";

const tag = `e2el-${Date.now()}`;
test.afterAll(() => cleanup(tag));

async function plan(page: Page, dayName: string, recipe: string, servings?: string) {
  const row = page
    .getByRole("region", { name: dayName })
    .locator("div.grid", { has: page.getByRole("heading", { name: "Dinner", exact: true }) });
  await row.getByText("Add a recipe").click();
  await row.getByRole("combobox").selectOption({ label: recipe });
  if (servings) await row.getByPlaceholder("servings").fill(servings);
  await row.getByRole("button", { name: "Add" }).click();
  await expect(row.getByRole("link", { name: recipe })).toBeVisible();
}

test("generate, shop and manage a list", async ({ page, browser }) => {
  await signupAndCreateHousehold(page, tag, "Ann");

  // empty state
  await page.goto("/lists");
  await expect(page.getByText("No lists yet")).toBeVisible();

  await addRecipe(page, `${tag} Pasta`, "4", [["400", "g", "spaghetti"], ["2", "cup", "milk"], ["3", "", "tomatoes"]]);
  await addRecipe(page, `${tag} Bake`, "2", [["1", "kg", "spaghetti"]]);

  await page.goto("/planner?week=2026-10-12");
  await plan(page, "Monday, Oct 12", `${tag} Pasta`, "2"); // half: 200 g, 1 cup, 1.5 tomatoes
  await plan(page, "Wednesday, Oct 14", `${tag} Pasta`); // as written: 400 g, 2 cup, 3 tomatoes
  await plan(page, "Friday, Oct 16", `${tag} Bake`); // 1 kg

  // a range with nothing planned explains itself and keeps the dates
  await page.goto("/lists");
  await page.getByLabel("From", { exact: true }).fill("2030-01-01");
  await page.getByLabel("To", { exact: true }).fill("2030-01-07");
  await page.getByRole("button", { name: "Generate from meal plan" }).click();
  await expect(page.getByText(/No meals are planned between those dates/)).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2030-01-01");

  // end before start
  await page.getByLabel("To", { exact: true }).fill("2029-12-01");
  await page.getByRole("button", { name: "Generate from meal plan" }).click();
  await expect(page.getByText("End date must be on or after the start date")).toBeVisible();

  // real generation
  await page.getByLabel("From", { exact: true }).fill("2026-10-12");
  await page.getByLabel("To", { exact: true }).fill("2026-10-18");
  await page.getByLabel("Name (optional)").fill(`${tag} Weekly`);
  await page.getByRole("button", { name: "Generate from meal plan" }).click();
  await expect(page.getByRole("heading", { name: `${tag} Weekly` })).toBeVisible();
  const listUrl = page.url();

  // scaled by servings, merged across recipes, nothing singularised
  await expect(page.getByLabel("1.6 kg spaghetti")).toBeVisible(); // 200 g + 400 g + 1 kg
  await expect(page.getByLabel("3 cup milk")).toBeVisible(); // 1 + 2, unit kept
  await expect(page.getByLabel("4 1/2 tomatoes")).toBeVisible(); // 1.5 + 3
  await expect(page.getByText("0 of 3 done")).toBeVisible();

  // grouped by aisle, in aisle order
  const sections = await page.getByRole("region").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(sections).toEqual(["Produce", "Dairy & eggs", "Pantry"]);

  // checking persists
  await page.getByLabel("3 cup milk").check();
  await expect(page.getByText("1 of 3 done")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("3 cup milk")).toBeChecked();
  await expect(page.getByText("1 of 3 done")).toBeVisible();

  // manual items: bad quantity keeps what was typed, fraction and default quantity work
  await page.getByLabel("Item name").fill("paper towels");
  await page.getByLabel("Quantity", { exact: true }).fill("lots");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Use a number like 2, 0.5 or 1/2")).toBeVisible();
  await expect(page.getByLabel("Item name")).toHaveValue("paper towels");
  await page.getByLabel("Quantity", { exact: true }).fill("1/2");
  await page.getByLabel("Unit", { exact: true }).fill("kg");
  await page.getByLabel("Item name").fill("bananas");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("1/2 kg bananas")).toBeVisible();
  await expect(page.getByLabel("Item name")).toHaveValue(""); // form cleared on success
  await page.getByLabel("Item name").fill("paper towels");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("1 paper towels")).toBeVisible();
  await expect(page.getByRole("region", { name: "Other" })).toBeVisible();

  // remove one, clear checked
  await page.getByRole("button", { name: "Remove paper towels" }).click();
  await expect(page.getByLabel("1 paper towels")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear 1 checked item" }).click();
  await expect(page.getByLabel("3 cup milk")).toHaveCount(0);
  await expect(page.getByLabel("1.6 kg spaghetti")).toBeVisible();

  // listed with progress
  await page.goto("/lists");
  await expect(page.getByRole("link", { name: new RegExp(`${tag} Weekly`) })).toContainText("0 of 3 done");

  // another household can't open it
  const other = await browser.newContext();
  const o = await other.newPage();
  await signupAndCreateHousehold(o, tag, "Eve");
  await o.goto(listUrl);
  expect(await o.content()).not.toContain("spaghetti");
  await expect(o.getByText(/could not be found/i)).toBeVisible();
  await o.goto("/lists");
  await expect(o.getByText("No lists yet")).toBeVisible();
  await other.close();

  // delete the list
  await page.goto(listUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete list" }).click();
  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByText("No lists yet")).toBeVisible();
});

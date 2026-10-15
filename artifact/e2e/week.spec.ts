import { expect, test, type Page } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const TODAY = "2026-10-14"; // Wednesday: the week is Mon Oct 12 - Sun Oct 18

const rec = (title: string, servings: number, ingredients: { name: string; quantity: number; unit: string }[]) => ({
  title, servings, tags: [], instructions: "", sourceUrl: null, ingredients,
});
const seed: Seed = {
  recipes: {
    rice: rec("رز مع دجاج", 4, [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }]),
    kofta: rec("كفتة", 2, [{ name: "رز", quantity: 1, unit: "كوب" }, { name: "طماطم", quantity: 3, unit: "حبة" }]),
    peas: rec("يخنة بازيلاء", 4, []),
  },
};

const food = (page: Page, title: string) => page.getByRole("button", { name: title, exact: true });
const buy = (page: Page) => page.getByRole("complementary");

test("choosing foods updates what to buy at once, scales, and is remembered per week", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed });
  await expect(page.getByText("12 أكتوبر – 18 أكتوبر 2026")).toBeVisible();
  await expect(buy(page).getByText("اضغط على طبق لترى ما تحتاج إلى شرائه.")).toBeVisible();

  await food(page, "رز مع دجاج").click();
  await expect(buy(page).getByText("2 كوب أرز")).toBeVisible();
  await food(page, "كفتة").click();
  await expect(buy(page).getByText("3 كوب أرز")).toBeVisible(); // rice merged across both foods

  // servings: kofta makes 2, so 4 doubles it; the hint shows what the recipe makes
  await expect(page.getByText("الوصفة تكفي: 2")).toBeVisible();
  await page.getByRole("button", { name: "حصص أكثر من كفتة" }).click();
  await page.getByRole("button", { name: "حصص أكثر من كفتة" }).click();
  await expect(buy(page).getByText("4 كوب أرز")).toBeVisible(); // 2 + 1x2
  await expect(buy(page).getByText("6 طماطم")).toBeVisible();
  await page.getByRole("button", { name: "حصص أقل من كفتة" }).click();
  await expect(buy(page).getByText("3.5 كوب أرز").or(buy(page).getByText("3 1/2 كوب أرز"))).toBeVisible();

  // untap: its lines go away at once
  await food(page, "كفتة").click();
  await expect(buy(page).getByText("طماطم")).toHaveCount(0);
  await expect(buy(page).getByText("2 كوب أرز")).toBeVisible();

  // another week has its own selection
  await page.getByRole("button", { name: /التالي/ }).click();
  await expect(food(page, "رز مع دجاج")).toHaveAttribute("aria-pressed", "false");
  await expect(buy(page).getByText("اضغط على طبق لترى ما تحتاج إلى شرائه.")).toBeVisible();
  await page.locator(".week-now").click();
  await expect(food(page, "رز مع دجاج")).toHaveAttribute("aria-pressed", "true");

  // saved, and survives a reload
  await expect.poll(async () => (await stored(page, "week")).map((w) => w.picks)).toEqual([[{ recipeId: "rice", servings: 4 }]]);
  await page.reload();
  await expect(food(page, "رز مع دجاج")).toHaveAttribute("aria-pressed", "true");
  await expect(buy(page).getByText("2 كوب أرز")).toBeVisible();
});

test("start shopping saves a snapshot, remembers it on the week, and later changes leave it alone", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed });
  await food(page, "رز مع دجاج").click();
  await buy(page).getByRole("button", { name: "Start shopping" }).click();

  await expect(page.getByRole("heading", { name: "Shopping 2026-10-14" })).toBeVisible();
  await expect(page.getByLabel("2 cup أرز")).toBeVisible();
  const [list] = await stored(page, "lists");
  expect(list).toMatchObject({ name: "Shopping 2026-10-14", rangeStart: "2026-10-12", rangeEnd: "2026-10-18", shoppedOn: "2026-10-14" });
  const [week] = await stored(page, "week");
  expect(week.listId).toBeTruthy();

  // back on This week: the banner, and the live panel keeps following the selection
  await page.getByRole("button", { name: "This week", exact: true }).first().click();
  await expect(buy(page).getByText("Shopping list started.")).toBeVisible();
  await page.getByRole("button", { name: "More servings of رز مع دجاج" }).click();
  await expect(buy(page).getByText("2 1/2 cup أرز")).toBeVisible();
  expect(((await stored(page, "lists"))[0].items as { quantity: number }[])[0].quantity).toBe(2); // the saved list did not change

  // a second press makes a fresh list from the current selection
  await buy(page).getByRole("button", { name: "Start a new list from this" }).click();
  await expect.poll(async () => (await stored(page, "lists")).length).toBe(2);

  // the banner survives a reload, and "Open it" goes to the list
  await page.reload();
  await page.getByRole("button", { name: "This week", exact: true }).first().click();
  await buy(page).getByRole("button", { name: "Open it" }).click();
  await expect(page.getByRole("heading", { name: /^Shopping/ })).toBeVisible();
});

test("a food with no ingredients says so and jumps to its form; deleting a food removes it from the week", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed });
  await expect(page.getByText("No ingredients yet")).toBeVisible();
  await food(page, "يخنة بازيلاء").click();
  await food(page, "رز مع دجاج").click();
  await expect(buy(page).getByRole("note")).toContainText("يخنة بازيلاء");
  await page.getByRole("button", { name: "Add ingredients" }).click();
  await expect(page.getByRole("heading", { name: "Edit recipe" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("يخنة بازيلاء");
  await expect(page.getByLabel("Type an ingredient")).toBeFocused(); // the ingredient sheet is already open
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "All recipes" }).click();
  await page.getByRole("button", { name: /^يخنة بازيلاء/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete recipe and take it off the week" }).click();
  await page.getByRole("button", { name: "This week", exact: true }).first().click();
  await expect(food(page, "يخنة بازيلاء")).toHaveCount(0);
  await expect.poll(async () => (await stored(page, "week")).map((w) => (w.picks as { recipeId: string }[]).map((p) => p.recipeId))).toEqual([["rice"]]);
});

test("with no foods saved it explains what to do", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week" });
  await expect(page.getByText("Save a food first")).toBeVisible();
});

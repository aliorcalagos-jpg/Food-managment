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

const rec2 = (title: string, servings: number, ingredients: { name: string; quantity: number; unit: string }[]) => ({ title, servings, tags: [], instructions: "", sourceUrl: null, ingredients });
const planSeed: Seed = {
  recipes: {
    rice: rec2("رز مع دجاج", 4, [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }]),
    kofta: rec2("كفتة", 2, [{ name: "رز", quantity: 1, unit: "كوب" }, { name: "طماطم", quantity: 3, unit: "" }]),
  },
};
const goTab = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).click();
const row = (page: Page, label: string) => page.locator("li.swipe").filter({ has: page.getByLabel(label, { exact: true }) });

test("picking foods creates the week's shopping list at once and keeps it in step, with pictures", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: planSeed });
  await expect(buy(page).getByRole("button", { name: "Open shopping list" })).toBeDisabled(); // nothing picked, no list
  expect(await stored(page, "lists")).toEqual([]);

  await food(page, "رز مع دجاج").click();
  await expect(buy(page).getByRole("button", { name: "Open shopping list" })).toBeEnabled();
  await expect.poll(async () => (await stored(page, "lists")).length).toBe(1);
  const [list] = await stored(page, "lists");
  expect(list).toMatchObject({ name: "Shopping · Oct 12 – Oct 18, 2026", rangeStart: "2026-10-12", rangeEnd: "2026-10-18", shoppedOn: TODAY });
  await expect.poll(async () => (await stored(page, "week"))[0]?.listId).toBe("week-2026-10-12");

  await buy(page).getByRole("button", { name: "Open shopping list" }).click();
  await expect(page.getByRole("heading", { name: /^Shopping ·/ })).toBeVisible();
  await expect(page.getByLabel("2 cup أرز")).toBeVisible();
  await expect(page.getByLabel("1 kg دجاج")).toBeVisible();
  await expect(row(page, "2 cup أرز").locator("svg.food-icon")).toBeVisible(); // the picture beside each item
  await expect(row(page, "1 kg دجاج").locator("svg.food-icon")).toBeVisible();

  // a second food: its lines are added and rice adds up
  await goTab(page, "This week");
  await food(page, "كفتة").click();
  await goTab(page, "Shopping");
  await page.getByRole("button", { name: /Shopping ·/ }).click();
  await expect(page.getByLabel("3 cup أرز")).toBeVisible();
  await expect(page.getByLabel("3 طماطم")).toBeVisible();

  // tick and price rice, add your own item
  await page.getByLabel("3 cup أرز").check();
  await page.getByLabel("Price for أرز").fill("1500");
  await page.getByLabel("Price for أرز").blur();
  await page.getByLabel("Add an item").fill("2 tomato");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(row(page, "2 tomato").locator("svg.food-icon")).toBeVisible(); // typed by hand but in the ingredient list
  await page.getByLabel("Add an item").fill("1 soap");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(row(page, "1 soap").locator("svg.food-icon")).toHaveCount(0); // not in the list: no picture

  // change servings of the first food: everything rescales, the tick and price stay
  await goTab(page, "This week");
  await page.getByRole("button", { name: "More servings of رز مع دجاج" }).click(); // 4 -> 5
  await goTab(page, "Shopping");
  await page.getByRole("button", { name: /Shopping ·/ }).click();
  await expect(page.getByLabel("3 1/2 cup أرز")).toBeChecked();
  await expect(page.getByLabel("Price for أرز")).toHaveValue("1500");
  await expect(page.getByLabel("1 1/4 kg دجاج")).toBeVisible();
  await expect(page.getByLabel("1 soap")).toBeVisible();

  // unpick the second food: its own line goes, yours stay
  await goTab(page, "This week");
  await food(page, "كفتة").click();
  await goTab(page, "Shopping");
  await page.getByRole("button", { name: /Shopping ·/ }).click();
  await expect(page.getByLabel("3 طماطم")).toHaveCount(0);
  await expect(page.getByLabel("2 1/2 cup أرز")).toBeChecked();
  await expect(page.getByLabel("1 soap")).toBeVisible();

  // survives a reload
  await page.reload();
  await page.getByRole("button", { name: /Shopping ·/ }).click();
  await expect(page.getByLabel("2 1/2 cup أرز")).toBeChecked();
  expect(await page.evaluate(() => (window as unknown as { __overlaps: number }).__overlaps)).toBe(0);
});

test("a line you remove stays removed, and an empty week has no list", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: planSeed });
  await food(page, "رز مع دجاج").click();
  await goTab(page, "Shopping");
  await page.getByRole("button", { name: /Shopping ·/ }).click();
  await page.getByRole("button", { name: "Remove دجاج" }).click(); // you already have chicken
  await expect(page.getByLabel("1 kg دجاج")).toHaveCount(0);

  await goTab(page, "This week");
  await page.getByRole("button", { name: "More servings of رز مع دجاج" }).click();
  await food(page, "كفتة").click();
  await goTab(page, "Shopping");
  await page.getByRole("button", { name: /Shopping ·/ }).click();
  await expect(page.getByLabel("3 1/2 cup أرز")).toBeVisible(); // the list follows the foods (rice 4 -> 5 servings, plus kofta)...
  await expect(page.getByRole("button", { name: "Remove دجاج" })).toHaveCount(0); // ...but chicken stays off

  // nothing picked and nothing bought: the list goes away
  await goTab(page, "This week");
  await food(page, "كفتة").click();
  await food(page, "رز مع دجاج").click();
  await goTab(page, "Shopping");
  await expect(page.getByText("No lists yet")).toBeVisible();
  expect(await stored(page, "lists")).toEqual([]);
});

test("editing a food's ingredients updates the week's list; each week has its own", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: planSeed });
  await food(page, "كفتة").click();
  await page.getByRole("button", { name: "Next" }).click();
  await food(page, "كفتة").click();
  await expect.poll(async () => (await stored(page, "lists")).map((l) => l.rangeStart).sort()).toEqual(["2026-10-12", "2026-10-19"]);

  await goTab(page, "Foods");
  await page.getByRole("button", { name: /كفتة/ }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Type an ingredient").fill("2 كوب عدس");
  await page.getByLabel("Type an ingredient").press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect.poll(async () => (await stored(page, "lists")).map((l) => (l.items as { name: string }[]).map((i) => i.name).includes("عدس"))).toEqual([true, true]);
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

test("the buy list says which foods need each item and how much meat to buy in all", async ({ page }) => {
  const meat = { ...planSeed, recipes: {
    kofta: rec("Kofta", 2, [{ name: "lamb", quantity: 1, unit: "kg" }, { name: "onion", quantity: 2, unit: "" }]),
    stew: rec("Stew", 4, [{ name: "lamb", quantity: 500, unit: "g" }, { name: "onion", quantity: 1, unit: "" }, { name: "chicken", quantity: 500, unit: "g" }]),
    salad: rec("Salad", 2, [{ name: "tomato", quantity: 3, unit: "" }]),
  } };
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: meat });
  await food(page, "Kofta").click();
  await food(page, "Stew").click();
  const panel = buy(page);
  // the meat total is in one place, and each line names its foods with their share
  await expect(panel.locator('[data-aisle-summary="Meat & fish"]')).toHaveText("2 dishes · 2 kg in total");
  await expect(panel.getByText("1 1/2 kg lamb")).toBeVisible(); // 1 kg + 500 g, shown as it is bought
  await expect(panel.getByText("Needed for Kofta 1 kg · Stew 500 g")).toBeVisible();
  await expect(panel.getByText("Needed for Stew", { exact: true })).toHaveCount(1); // chicken: one food, just its name
  await expect(panel.locator('[data-aisle-summary="Produce"]')).toHaveText("2 dishes");

  // changing servings changes the shares
  await page.getByRole("button", { name: "More servings of Kofta" }).click();
  await expect(panel.getByText("Needed for Kofta 1 1/2 kg · Stew 500 g")).toBeVisible();

  // the week's list shows the same facts, and the row's name stays just the item
  await goTab(page, "Shopping");
  await page.getByRole("button", { name: /Shopping ·/ }).click();
  await expect(page.getByLabel("2 kg lamb")).toBeVisible();
  await expect(page.getByText("Needed for Kofta 1 1/2 kg · Stew 500 g")).toBeVisible();
  await expect(page.locator('[data-aisle-summary="Meat & fish"]')).toContainText("2 dishes");
});

test("Arabic: the same in Arabic, with Arabic unit words", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed: { recipes: {
    a: rec("كفتة", 2, [{ name: "لحم", quantity: 1, unit: "كيلو" }]),
    b: rec("يخنة", 2, [{ name: "لحم", quantity: 500, unit: "جم" }]),
  } } });
  await food(page, "كفتة").click();
  await food(page, "يخنة").click();
  const panel = buy(page);
  await expect(panel.locator('[data-aisle-summary="Meat & fish"]')).toHaveText("طبقان · المجموع 1 1/2 كيلو");
  await expect(panel.getByText("مطلوب لـ كفتة 1 كيلو · يخنة 500 جم")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const TODAY = "2026-10-14";
const rec = (title: string, ingredients: { name: string; quantity: number; unit: string }[]) => ({ title, servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients });
const seed: Seed = {
  recipes: {
    a: rec("يخنة بازيلاء", []),
    b: rec("رز مع دجاج", [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }]),
  },
};

const quick = (page: Page) => page.getByLabel("اكتب مكوّنًا");
const rowValues = (page: Page, n: number) =>
  Promise.all([page.getByLabel(`الكمية ${n}`, { exact: true }).inputValue(), page.getByLabel(`الوحدة ${n}`, { exact: true }).inputValue(), page.getByLabel(`المكوّن ${n}`, { exact: true }).inputValue()]);

test("a food with no ingredients opens ready to type; each line becomes a row; names snap to the ones already used", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed });
  await page.locator("li.food", { hasText: "يخنة بازيلاء" }).getByRole("button", { name: "أضف المكوّنات" }).click();
  await expect(quick(page)).toBeFocused();

  await quick(page).fill("٢ كوب رز"); // رز is already written أرز in another food
  await quick(page).press("Enter");
  await expect(quick(page)).toHaveValue("");
  await expect(quick(page)).toBeFocused();
  expect(await rowValues(page, 1)).toEqual(["2", "كوب", "أرز"]);
  await quick(page).fill("500 جم بطاطس");
  await quick(page).press("Enter");
  expect(await rowValues(page, 2)).toEqual(["500", "جم", "بطاطس"]);
  await expect(page.getByLabel("الكمية 3", { exact: true })).toHaveCount(0); // the empty starter row was replaced, not kept

  // a line with no number leaves the quantity for you, and puts the cursor there
  await quick(page).fill("ملح");
  await quick(page).press("Enter");
  expect(await rowValues(page, 3)).toEqual(["", "", "ملح"]);
  await expect(page.getByLabel("الكمية 3", { exact: true })).toBeFocused();
  await page.getByLabel("الكمية 3", { exact: true }).fill("1");
  await page.getByLabel("الوحدة 3", { exact: true }).fill("ملعقة صغيرة");

  await page.getByRole("button", { name: "حفظ الوصفة" }).click();
  await expect(page.getByText("500 جم بطاطس")).toBeVisible();
  await expect.poll(async () => (await stored(page, "recipes")).find((r) => r.title === "يخنة بازيلاء")?.ingredients).toEqual([
    { name: "أرز", quantity: 2, unit: "كوب" },
    { name: "بطاطس", quantity: 500, unit: "جم" },
    { name: "ملح", quantity: 1, unit: "ملعقة صغيرة" },
  ]);
});

test("pasting a whole list adds every line, and Enter in the last name box starts the next row", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "recipes", seed });
  await page.getByRole("button", { name: "New recipe" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Stew");
  await page.getByLabel("Type an ingredient").evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData("text", text);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, "- 1 1/2 kg lamb\n- 3 tomatoes\n\n- 2 cups of milk\n");
  await expect(page.getByLabel("Quantity 3", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Quantity 4", { exact: true })).toHaveCount(0);
  expect(await Promise.all([1, 2, 3].map((n) => page.getByLabel(`Ingredient ${n}`, { exact: true }).inputValue()))).toEqual(["lamb", "tomatoes", "milk"]);
  expect(await page.getByLabel("Quantity 1", { exact: true }).inputValue()).toBe("1 1/2");
  expect(await page.getByLabel("Unit 3", { exact: true }).inputValue()).toBe("cups");

  await page.getByLabel("Ingredient 3", { exact: true }).press("Enter"); // moves on to a new row, does not save
  await expect(page.getByLabel("Quantity 4", { exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "New recipe" })).toBeVisible();
  await page.getByLabel("Ingredient 4", { exact: true }).press("Enter"); // an empty last row does not grow the list
  await expect(page.getByLabel("Quantity 5", { exact: true })).toHaveCount(0);
});

test("name boxes suggest names already used, once each", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "recipes", seed });
  await page.getByRole("button", { name: "New recipe" }).click();
  const options = await page.locator("#ing-names option").evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(options.sort()).toEqual(["أرز", "دجاج"]);
  await expect(page.getByLabel("Ingredient 1", { exact: true })).toHaveAttribute("list", "ing-names");
});

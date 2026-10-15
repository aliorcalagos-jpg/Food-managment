import { expect, test, type Page } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const TODAY = "2026-10-14"; // Wednesday, so the week is Mon Oct 12 - Sun Oct 18

// The user's own dishes, exactly as written, with no ingredients yet.
const DISHES = ["يخنة بازيلاء", "يخنة بامياء", "يخنة فاصولياء", "كفتة مع بطاطس و ارز وطماطم", "رز مع دجاج"];
const seed: Seed = {
  recipes: Object.fromEntries(
    DISHES.map((title, i) => [`dish-${i + 1}`, { title, servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients: [] }]),
  ),
};

async function addIngredients(page: Page, rows: [string, string, string][]) {
  for (const [i, [qty, unit, name]] of rows.entries()) {
    if (i > 0) await page.getByRole("button", { name: "+ إضافة مكوّن" }).click();
    await page.getByLabel(`الكمية ${i + 1}`, { exact: true }).fill(qty);
    await page.getByLabel(`الوحدة ${i + 1}`, { exact: true }).fill(unit);
    await page.getByLabel(`المكوّن ${i + 1}`, { exact: true }).fill(name);
  }
  await page.getByRole("button", { name: "حفظ الوصفة" }).click();
}

test("opens in Arabic, right-to-left, and the switch flips direction, text and the saved setting", async ({ page }) => {
  await openArtifact(page, { today: TODAY, seed, lang: null });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { name: "مخطط الوجبات", level: 1 })).toBeVisible();
  for (const dish of DISHES) await expect(page.getByRole("button", { name: new RegExp(dish) })).toBeVisible();

  await page.getByRole("button", { name: "اللغة" }).click(); // shows "English"
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Meal Planner", level: 1 })).toBeVisible();
  // dish names stay as written, in either interface language
  await expect(page.getByRole("button", { name: /رز مع دجاج/ })).toBeVisible();
  expect(await stored(page, "meta")).toEqual([{ lang: "en", currency: "NGN", rate: 1380, weeklyBudget: null }]); // saved in the db, so every device agrees

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await stored(page, "meta")).toEqual([{ lang: "ar", currency: "NGN", rate: 1380, weeklyBudget: null }]);
});

test("the user's five dishes: add ingredients in Arabic, plan, and get one merged list", async ({ page }) => {
  await openArtifact(page, { today: TODAY, seed, lang: "ar" });

  // dishes without ingredients are labelled, not shown as "0"
  await expect(page.getByRole("button", { name: /رز مع دجاج/ })).toContainText("لا مكوّنات بعد");

  // search folds spelling variants: ارز finds the dishes with أرز / رز in them
  await page.getByLabel("ابحث في الوصفات").fill("الأرز");
  await expect(page.getByRole("button", { name: /رز مع دجاج/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /كفتة/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /يخنة/ })).toHaveCount(0);
  await page.getByLabel("ابحث في الوصفات").fill("بامياء");
  await expect(page.getByRole("button", { name: /يخنة بامياء/ })).toBeVisible();
  await page.getByLabel("ابحث في الوصفات").fill("");

  // رز مع دجاج: Arabic digits, an Arabic unit word, and a fraction
  await page.getByRole("button", { name: /^رز مع دجاج/ }).click();
  await expect(page.getByText("لا توجد مكوّنات بعد")).toBeVisible();
  await page.getByRole("button", { name: "أضف المكوّنات" }).click();
  await addIngredients(page, [["٢", "كوب", "أرز"], ["١ ١/٢", "كيلو", "دجاج"]]);
  await expect(page.getByText("2 كوب أرز")).toBeVisible();
  await expect(page.getByText("1 1/2 كيلو دجاج")).toBeVisible();
  await page.getByRole("button", { name: "كل الوصفات" }).click();

  // كفتة: rice written the other way, a different unit spelling, and a count word
  await page.getByRole("button", { name: /^كفتة/ }).click();
  await page.getByRole("button", { name: "تعديل", exact: true }).click();
  await addIngredients(page, [["1", "كوب", "رز"], ["500", "جم", "بطاطس"], ["3", "حبة", "طماطم"]]);
  await expect(page.getByText("500 جم بطاطس")).toBeVisible();
  await page.getByRole("button", { name: "كل الوصفات" }).click();

  // this week, in Arabic: tap three dishes (يخنة بازيلاء has no ingredients yet)
  await page.getByRole("button", { name: "هذا الأسبوع", exact: true }).first().click();
  const food = (title: string) => page.getByRole("button", { name: title, exact: true });
  const buy = page.getByRole("complementary");
  await food("رز مع دجاج").click();
  await food("كفتة مع بطاطس و ارز وطماطم").click();
  await food("يخنة بازيلاء").click();

  // what to buy, at once: one rice line, whichever spelling was used, grouped by Arabic aisle names
  await expect(buy.getByText("3 كوب أرز")).toBeVisible(); // 2 + 1 cups
  await expect(buy.getByText("500 جم بطاطس")).toBeVisible();
  await expect(buy.getByText("1 1/2 كيلو دجاج")).toBeVisible();
  await expect(buy.getByText("3 طماطم")).toBeVisible();
  await expect(buy.locator("li", { hasText: "كوب" })).toHaveCount(1); // both rice spellings merged
  expect(await buy.locator("section.aisle").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual([
    "الخضار والفاكهة",
    "اللحوم والأسماك",
    "المؤن",
  ]);
  await expect(buy.getByText("4 عناصر")).toBeVisible();
  // the dish with no ingredients is named instead of silently missing, with a way to fix it
  await expect(buy.getByRole("note")).toContainText("يخنة بازيلاء");
  await expect(buy.locator('li bdi[dir="ltr"]', { hasText: "1 1/2" })).toHaveCount(1); // quantities are left-to-right runs

  // start shopping: the list opens with an Arabic default name
  await buy.getByRole("button", { name: "ابدأ التسوق" }).click();
  await expect(page.getByRole("heading", { name: /^تسوق / })).toBeVisible();
  await expect(page.getByLabel("3 كوب أرز")).toBeVisible();
  await expect(page.getByText("تم: 0 من 4")).toBeVisible();

  // ticking works in Arabic too
  await page.getByLabel("3 كوب أرز").check();
  await expect(page.getByText("تم: 1 من 4")).toBeVisible();
});

test("a food with no ingredients is named, can be fixed from This week, and the buy list stays empty", async ({ page }) => {
  await openArtifact(page, {
    today: TODAY,
    lang: "ar",
    tab: "week",
    seed: { ...seed, week: { "2026-10-12": { picks: [{ recipeId: "dish-1", servings: 4 }], listId: null } } },
  });
  const buy = page.getByRole("complementary");
  await expect(buy.getByText("الأطباق المختارة بلا مكوّنات بعد.")).toBeVisible();
  await expect(buy.getByRole("button", { name: "ابدأ التسوق" })).toBeDisabled();
  expect(await stored(page, "lists")).toEqual([]); // nothing half-made was saved
  await page.locator("li.food", { hasText: "يخنة بازيلاء" }).getByRole("button", { name: "أضف المكوّنات" }).click(); // jumps to that dish's edit form
  await expect(page.getByLabel("الاسم", { exact: true })).toHaveValue(/^يخنة/);
});

test("English users get plain English for the same situations", async ({ page }) => {
  await openArtifact(page, {
    today: TODAY,
    lang: "en",
    tab: "week",
    seed: { ...seed, week: { "2026-10-12": { picks: [{ recipeId: "dish-1", servings: 4 }], listId: null } } },
  });
  await expect(page.getByRole("complementary").getByText("The chosen foods have no ingredients yet.")).toBeVisible();
  await expect(page.getByRole("complementary").getByRole("note")).toContainText("Not on the list because they have no ingredients yet: يخنة بازيلاء");
});

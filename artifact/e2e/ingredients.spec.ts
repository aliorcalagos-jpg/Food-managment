import { expect, test } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const TODAY = "2026-10-14";
const rec = (title: string, ingredients: { name: string; quantity: number; unit: string }[]) => ({ title, servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients });
const seed: Seed = {
  recipes: {
    a: rec("يخنة بازيلاء", []),
    b: rec("رز مع دجاج", [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }]),
  },
};

test("a food with no ingredients opens ready to type; lines, chips and name suggestions fill it in", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed });
  await page.locator("li.pick", { hasText: "يخنة بازيلاء" }).getByRole("button", { name: "أضف المكوّنات" }).click();
  const line = page.getByLabel("اكتب مكوّنًا");
  await expect(line).toBeFocused();

  await line.fill("٢ كوب رز"); // رز is already written أرز in another food
  // the preview shows how the line was understood, using that spelling
  const preview = page.locator(".preview");
  await expect(preview).toContainText("2");
  await expect(preview).toContainText("كوب");
  await expect(preview).toContainText("أرز");
  await line.press("Enter");
  await expect(line).toHaveValue("");
  await expect(line).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "أُضيف مكوّن واحد" })).toBeVisible();

  await line.fill("500 جم بطاطس");
  await line.press("Enter");

  // a line with no number cannot be added until it has a quantity; the chips supply one
  await line.fill("ملح");
  await expect(page.getByText("أضف كمية")).toBeVisible();
  await expect(page.getByRole("button", { name: "إضافة", exact: true })).toBeDisabled();
  await page.getByRole("group", { name: "الوحدة" }).getByRole("button", { name: "ملعقة صغيرة" }).click(); // a unit with no quantity starts at 1
  await expect(line).toHaveValue("1 ملعقة صغيرة ملح");
  await line.press("Enter");

  // suggestions come from names already used, narrowing as you type
  await expect(page.getByRole("group", { name: "استخدمته من قبل" }).getByRole("button")).toHaveCount(2); // دجاج and أرز (بطاطس is only here)
  await line.fill("2 كيلو دج");
  await expect(page.getByRole("group", { name: "استخدمته من قبل" }).getByRole("button")).toHaveText(["دجاج"]);
  await page.getByRole("group", { name: "استخدمته من قبل" }).getByRole("button", { name: "دجاج" }).click();
  await expect(line).toHaveValue("2 كيلو دجاج");
  await line.press("Enter");

  await page.getByRole("button", { name: "تم", exact: true }).click();
  await expect(page.locator(".ing-line")).toHaveCount(4);
  await page.getByRole("button", { name: "حفظ الوصفة" }).click();
  await expect(page.getByText("500 جم بطاطس")).toBeVisible();
  await expect
    .poll(async () => (await stored(page, "recipes")).find((r) => r.title === "يخنة بازيلاء")?.ingredients)
    .toEqual([
      { name: "أرز", quantity: 2, unit: "كوب" },
      { name: "بطاطس", quantity: 500, unit: "جم" },
      { name: "ملح", quantity: 1, unit: "ملعقة صغيرة" },
      { name: "دجاج", quantity: 2, unit: "كيلو" },
    ]);
});

test("pasting a whole list adds every line; a row can be edited and removed", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "recipes", seed });
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Stew");
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Type an ingredient").evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData("text", text);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, "- 1 1/2 kg lamb\n- 3 tomatoes\n\n- 2 cups of milk\n");
  await expect(page.getByText("3 lines will be added")).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".ing-line")).toHaveText([/1 1\/2 kg lamb/, /3 tomatoes/, /2 cups milk/]);

  // tap a row to change it
  await page.getByRole("button", { name: /3 tomatoes/ }).click();
  await expect(page.getByRole("dialog", { name: "Edit ingredient" })).toBeVisible();
  await page.getByLabel("Type an ingredient").fill("4 tomatoes");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.locator(".ing-line").nth(1)).toContainText("4 tomatoes");

  // remove one, add one with chips only
  await page.getByRole("button", { name: "Remove ingredient 3" }).click();
  await expect(page.locator(".ing-line")).toHaveCount(2);
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Type an ingredient").fill("salt");
  await page.getByRole("group", { name: "Quantity" }).getByRole("button", { name: "1/2", exact: true }).click();
  await page.getByRole("group", { name: "Unit" }).getByRole("button", { name: "tsp" }).click();
  await page.getByLabel("Type an ingredient").press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect
    .poll(async () => (await stored(page, "recipes")).find((r) => r.title === "Stew")?.ingredients)
    .toEqual([
      { name: "lamb", quantity: 1.5, unit: "kg" },
      { name: "tomatoes", quantity: 4, unit: "" },
      { name: "salt", quantity: 0.5, unit: "tsp" },
    ]);
});

test("Escape closes the sheet and keeps what was added", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "recipes", seed });
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Type an ingredient").fill("2 cups rice");
  await page.getByLabel("Type an ingredient").press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".ing-line")).toHaveCount(1);
});

test("choose from the list: groups, search, the usual unit, custom names, and the right aisles", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed });
  await page.locator("li.pick", { hasText: "يخنة بازيلاء" }).getByRole("button", { name: "أضف المكوّنات" }).click();
  const line = page.getByLabel("اكتب مكوّنًا");
  const groups = page.getByRole("group", { name: "اختر من القائمة" });
  const pickItem = (name: string) => page.locator(".catalog-items").getByRole("button", { name, exact: true });

  // vegetables are shown first; tap one, then a quantity
  await expect(page.locator(".catalog-items").getByRole("button")).not.toHaveCount(0);
  await pickItem("طماطم").click();
  await expect(line).toHaveValue("طماطم");
  await expect(page.getByText("أضف كمية")).toBeVisible(); // the quantity is never filled in for you
  await expect(page.getByRole("button", { name: "إضافة", exact: true })).toBeDisabled();
  await page.getByRole("group", { name: "الكمية" }).getByRole("button", { name: "3", exact: true }).click();
  await expect(line).toHaveValue("3 طماطم");
  await line.press("Enter");

  // another group; the usual unit (grams for chicken) is offered and applied with the quantity
  await groups.getByRole("button", { name: "دجاج", exact: true }).click();
  await expect(groups.getByRole("button", { name: "دجاج", exact: true })).toHaveAttribute("aria-pressed", "true");
  await pickItem("صدور دجاج").click();
  await expect(line).toHaveValue("صدور دجاج");
  await expect(page.getByRole("group", { name: "الوحدة" }).getByRole("button", { name: "جم", exact: true })).toHaveClass(/suggested/);
  await page.getByRole("group", { name: "الكمية" }).getByRole("button", { name: "500", exact: true }).click();
  await expect(line).toHaveValue("500 جم صدور دجاج");
  await line.press("Enter");

  // typing searches every group, spelling folded; the group of each match is shown
  await line.fill("ارز");
  const results = page.getByRole("group", { name: "مكوّنات مطابقة" });
  await expect(results.getByRole("button", { name: /^أرز/ }).first()).toContainText("بقوليات وحبوب");
  await expect(results.getByRole("button", { name: /أرز بسمتي/ })).toBeVisible();
  await expect(groups).toHaveCount(0); // the group row gives way to search results
  await line.fill("دجاج");
  await expect(results.getByRole("button")).toContainText(["صدور دجاج"]);
  expect(await results.getByRole("button").count()).toBeGreaterThan(8);

  // a name that is not in the list is added as typed
  await line.fill("2 كوب فول سوداني");
  await expect(page.getByText("غير موجود في القائمة")).toBeVisible();
  await line.press("Enter");
  await page.getByRole("button", { name: "تم", exact: true }).click();
  await page.getByRole("button", { name: "حفظ الوصفة" }).click();
  await expect
    .poll(async () => (await stored(page, "recipes")).find((r) => r.title === "يخنة بازيلاء")?.ingredients)
    .toEqual([
      { name: "طماطم", quantity: 3, unit: "" },
      { name: "صدور دجاج", quantity: 500, unit: "جم" },
      { name: "فول سوداني", quantity: 2, unit: "كوب" },
    ]);

  // on the shopping list they land in the right aisles
  await page.getByRole("button", { name: "هذا الأسبوع", exact: true }).click();
  await page.locator("li.pick", { hasText: "يخنة بازيلاء" }).getByRole("button", { name: "يخنة بازيلاء", exact: true }).click();
  expect(await page.getByRole("complementary").locator("section.aisle").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual([
    "الخضار والفاكهة",
    "اللحوم والأسماك",
    "المؤن", // فول سوداني is a pantry item
  ]);
});

test("in English the list shows English names and keeps them as picked", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "recipes", seed });
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByRole("group", { name: "Choose from the list" }).getByRole("button", { name: "Meat", exact: true }).click();
  await page.locator(".catalog-items").getByRole("button", { name: "minced beef", exact: true }).click();
  await page.getByRole("group", { name: "Quantity" }).getByRole("button", { name: "250", exact: true }).click();
  await expect(page.getByLabel("Type an ingredient")).toHaveValue("250 g minced beef");
  await page.getByLabel("Type an ingredient").press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Kofta tray");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect
    .poll(async () => (await stored(page, "recipes")).find((r) => r.title === "Kofta tray")?.ingredients)
    .toEqual([{ name: "minced beef", quantity: 250, unit: "g" }]);
});

for (const width of [320, 390]) {
  test(`the list fits a ${width}px phone with comfortable chips`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openArtifact(page, { today: TODAY, lang: "ar", tab: "recipes", seed });
    await page.getByRole("button", { name: "طبق جديد" }).click();
    await page.getByRole("button", { name: "إضافة مكوّن" }).click();
    for (const g of ["خضار", "لحوم", "دجاج", "أسماك ومأكولات بحرية", "بقوليات وحبوب", "ألبان وبيض", "زيوت ودهون", "بهارات وصلصات"]) {
      await page.getByRole("group", { name: "اختر من القائمة" }).getByRole("button", { name: g, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), g).toBe(true);
      const small = await page.locator(".catalog-items .tile").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
      expect(small, g).toBe(0);
    }
  });
}

test("every option has a picture; the long vegetable and meat lists are there; pictures also show on the dish", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed });
  await page.locator("li.pick", { hasText: "يخنة بازيلاء" }).getByRole("button", { name: "أضف المكوّنات" }).click();
  const tiles = page.locator(".catalog-items .tile");
  const groups = page.getByRole("group", { name: "اختر من القائمة" });

  await expect.poll(() => tiles.count()).toBeGreaterThanOrEqual(85); // vegetables
  expect(await page.locator(".catalog-items .tile svg.food-icon[aria-hidden='true']").count()).toBe(await tiles.count());
  await expect(page.locator(".catalog-items").getByRole("button", { name: "فلفل رومي أخضر", exact: true })).toBeVisible();

  await groups.getByRole("button", { name: "لحوم", exact: true }).click();
  await expect.poll(() => tiles.count()).toBeGreaterThanOrEqual(40);
  for (const cut of ["سيرلوين بقري", "ريب آي بقري", "ذيل بقري", "راك ضأن", "كلاوي بقري"]) await expect(page.locator(".catalog-items").getByRole("button", { name: cut, exact: true })).toBeVisible();
  await groups.getByRole("button", { name: "دجاج", exact: true }).click();
  await expect.poll(() => tiles.count()).toBeGreaterThanOrEqual(20);
  await expect(page.locator(".catalog-items").getByRole("button", { name: "قلوب دجاج", exact: true })).toBeVisible();

  // the picture also shows in the preview, and then on the dish's ingredient line and detail page
  await page.locator(".catalog-items").getByRole("button", { name: "وراك دجاج", exact: true }).click();
  await expect(page.locator(".preview .pv-name svg.food-icon")).toBeVisible();
  await page.getByRole("group", { name: "الكمية" }).getByRole("button", { name: "500", exact: true }).click();
  await page.getByLabel("اكتب مكوّنًا").press("Enter");
  await page.getByLabel("اكتب مكوّنًا").fill("2 كوب فول سوداني"); // not in the list: no picture
  await page.getByLabel("اكتب مكوّنًا").press("Enter");
  await page.getByRole("button", { name: "تم", exact: true }).click();
  await expect(page.locator(".ing-line").nth(0).locator("svg.food-icon")).toBeVisible();
  await expect(page.locator(".ing-line").nth(1).locator("svg.food-icon")).toHaveCount(0);
  await page.getByRole("button", { name: "حفظ الوصفة" }).click();
  await expect(page.locator(".ing-row-detail").nth(0).locator("svg.food-icon")).toBeVisible();
});

for (const width of [320, 390]) {
  test(`picture tiles fit a ${width}px phone: no sideways scroll, big enough to tap`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openArtifact(page, { today: TODAY, lang: "ar", tab: "recipes", seed });
    await page.getByRole("button", { name: "طبق جديد" }).click();
    await page.getByRole("button", { name: "إضافة مكوّن" }).click();
    for (const g of ["خضار", "لحوم", "دجاج"]) {
      await page.getByRole("group", { name: "اختر من القائمة" }).getByRole("button", { name: g, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), g).toBe(true);
      const small = await page.locator(".catalog-items .tile").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 60).length);
      expect(small, g).toBe(0);
    }
  });
}

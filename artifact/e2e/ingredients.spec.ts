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

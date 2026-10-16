import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

// The page the Android app ships: no claude.ai, no network, data kept on the device.
const html = readFileSync(resolve(__dirname, "../dist/standalone/index.html"), "utf8");
const ORIGIN = "https://app.local";

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/index.html`, (r) => r.fulfill({ contentType: "text/html", body: html }));
});

test("works with no network at all, in Arabic, and keeps what you save across restarts", async ({ page }) => {
  const outside: string[] = [];
  await page.route(/^https?:\/\/(?!app\.local).*/, (r) => {
    outside.push(r.request().url());
    return r.abort();
  });
  await page.goto(`${ORIGIN}/index.html`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "مخطط الوجبات", level: 1 })).toBeVisible();
  await expect(page.getByText("ليس لديك أطباق")).toBeHidden(); // it is not the "storage unavailable" screen

  await page.getByRole("button", { name: "الأطباق", exact: true }).click();
  await page.getByRole("button", { name: "طبق جديد" }).click();
  await page.getByLabel("الاسم", { exact: true }).fill("يخنة بامياء");
  await page.getByRole("button", { name: "إضافة مكوّن" }).click();
  await page.getByLabel("اكتب مكوّنًا").fill("٢ كوب رز و١ كيلو لحم");
  await page.getByLabel("اكتب مكوّنًا").press("Enter");
  await page.getByRole("button", { name: "تم", exact: true }).click();
  await page.getByRole("button", { name: "حفظ الوصفة" }).click();
  await expect(page.getByRole("heading", { name: "يخنة بامياء" })).toBeVisible();

  // pick it for the week: the week's shopping list builds itself, also on the device
  await page.getByRole("button", { name: "هذا الأسبوع", exact: true }).click();
  await page.getByRole("button", { name: "يخنة بامياء", exact: true }).click();
  await page.getByRole("button", { name: "التسوق", exact: true }).click();
  await expect(page.getByRole("button", { name: /^تسوق ·/ })).toBeVisible();

  // a restart (reload) brings everything back
  await page.reload();
  await page.getByRole("button", { name: "الأطباق", exact: true }).click();
  await expect(page.getByRole("button", { name: /يخنة بامياء/ })).toBeVisible();
  await page.getByRole("button", { name: "التسوق", exact: true }).click();
  await expect(page.getByRole("button", { name: /^تسوق ·/ })).toBeVisible();
  expect(outside).toEqual([]);
});

test("the back button closes what is open before leaving the app", async ({ page }) => {
  await page.goto(`${ORIGIN}/index.html`);
  const back = () => page.evaluate(() => (window as unknown as { __back: () => boolean }).__back());
  await page.getByRole("button", { name: "الأطباق", exact: true }).click();
  await page.getByRole("button", { name: "طبق جديد" }).click();
  await page.getByRole("button", { name: "إضافة مكوّن" }).click();
  await expect(page.getByRole("dialog", { name: "إضافة مكوّن" })).toBeVisible();
  expect(await back()).toBe(true); // closes the ingredient sheet
  await expect(page.getByRole("dialog", { name: "إضافة مكوّن" })).toHaveCount(0);
  expect(await back()).toBe(true); // leaves the form
  await expect(page.getByRole("button", { name: "طبق جديد" })).toBeVisible();
  expect(await back()).toBe(true); // back to This week
  await expect(page.getByRole("button", { name: "هذا الأسبوع", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await back()).toBe(false); // nothing left: the app may exit
});

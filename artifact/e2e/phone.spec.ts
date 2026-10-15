import { expect, test } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const TODAY = "2026-10-14";
test.use({ viewport: { width: 390, height: 844 } });

const rec = (title: string, servings: number, ingredients: { name: string; quantity: number; unit: string }[]) => ({ title, servings, tags: [], instructions: "", sourceUrl: null, ingredients });
const seed: Seed = {
  recipes: {
    rice: rec("رز مع دجاج", 4, [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }]),
    kofta: rec("كفتة", 2, [{ name: "رز", quantity: 1, unit: "كوب" }, { name: "طماطم", quantity: 3, unit: "حبة" }]),
  },
};

test("opens on This week with a bottom bar; the summary bar opens the what-to-buy sheet and starts shopping", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: null, seed });
  await expect(page.getByRole("button", { name: "هذا الأسبوع", exact: true })).toHaveAttribute("aria-current", "page"); // the app's home
  await expect(page.getByRole("navigation", { name: "الأقسام" }).getByRole("button")).toHaveCount(4);
  await expect(page.getByRole("complementary")).toHaveCount(0); // no side column on a phone

  const bar = page.locator(".sticky-bar");
  await expect(bar).toContainText("لم تختر شيئًا بعد");
  await expect(bar.getByRole("button", { name: "ابدأ التسوق" })).toBeDisabled();

  await page.getByRole("button", { name: "رز مع دجاج", exact: true }).click();
  await page.getByRole("button", { name: "كفتة", exact: true }).click();
  await expect(bar).toContainText("2 أطباق");
  await expect(bar).toContainText("3 عناصر"); // أرز (merged), دجاج, طماطم

  await bar.getByRole("button", { name: /اضغط لعرض القائمة/ }).click();
  const sheet = page.getByRole("dialog", { name: "ما يجب شراؤه" });
  await expect(sheet.getByText("3 كوب أرز")).toBeVisible();
  await expect(sheet.getByText("3 طماطم")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // nothing is wider than the phone, and every control is a comfortable size
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const tooSmall = await page.locator("button:visible, input:visible").evaluateAll((els) =>
    els.filter((e) => { const r = e.getBoundingClientRect(); return r.height < 40 && !(e as HTMLInputElement).type?.match(/checkbox/); }).map((e) => e.outerHTML.slice(0, 80)),
  );
  expect(tooSmall).toEqual([]);

  await bar.getByRole("button", { name: "ابدأ التسوق" }).click();
  await expect(page.getByRole("heading", { name: /^تسوق / })).toBeVisible();
  await expect.poll(async () => (await stored(page, "lists")).length).toBe(1);
});

test("shopping: ticking moves an item to the basket, the bar totals spent and planned, prices are one tap away", async ({ page }) => {
  const items = [
    { id: "a", name: "rice", quantity: 1, unit: "kg", category: "Pantry", checked: false, price: 100000 },
    { id: "b", name: "oil", quantity: 1, unit: "l", category: "Pantry", checked: false, price: null },
  ];
  await openArtifact(page, { today: TODAY, lang: "en", tab: "lists", seed: { lists: { l1: { name: "Market", rangeStart: null, rangeEnd: null, createdAt: "2026-10-14T08:00:00Z", shoppedOn: "2026-10-14", items } } } });
  await page.getByRole("button", { name: /Market/ }).click();
  const bar = page.locator(".sticky-bar");
  await expect(bar).toContainText("Planned ₦1,000"); // priced but not ticked
  await expect(page.getByRole("button", { name: /In the basket/ })).toHaveCount(0);

  await page.getByLabel("1 kg rice").check();
  await expect(bar).toContainText("Bought ₦1,000");
  await expect(page.getByRole("button", { name: "In the basket (1)" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "In the basket (1)" }).click(); // collapse
  await expect(page.getByLabel("1 kg rice")).toHaveCount(0);
  await expect(page.getByLabel("1 l oil")).toBeVisible();
  await page.getByText("1 item without a price").waitFor();

  await page.getByLabel("Price for oil").fill("2500");
  await page.getByLabel("Price for oil").blur();
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { price: number | null }[])[1].price).toBe(250000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

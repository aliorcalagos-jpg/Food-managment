import { expect, test, type Locator, type Page } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const TODAY = "2026-10-14";
const rec = (title: string, ingredients: { name: string; quantity: number; unit: string }[]) => ({ title, servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients });
const item = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, quantity: 1, unit: "", category: "Pantry", checked: false, price: null, ...extra });
const seed = (items = [item("a", "rice"), item("b", "oil"), item("c", "salt")]): Seed => ({
  recipes: {
    r1: rec("رز مع دجاج", [{ name: "أرز", quantity: 2, unit: "كوب" }]),
    r2: rec("يخنة بامياء", []),
  },
  week: { "2026-10-12": { picks: [{ recipeId: "r1", servings: 4 }], listId: null } },
  lists: { l1: { name: "Market", rangeStart: "2026-10-12", rangeEnd: "2026-10-18", createdAt: "2026-10-14T08:00:00Z", shoppedOn: "2026-10-14", items } },
});

/** A mouse drag across a row, like a finger swipe. */
async function drag(page: Page, row: Locator, dx: number) {
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y);
  await page.mouse.up();
}
const rowOf = (page: Page, name: string) => page.locator("li.swipe").filter({ has: page.getByLabel(`1 ${name}`, { exact: true }) });
const openList = async (page: Page) => page.getByRole("button", { name: /Market/ }).click();

const SIZES: [string, number, number][] = [
  ["iPhone SE", 320, 568], ["iPhone SE 2", 375, 667], ["iPhone 14", 390, 844], ["iPhone Pro Max", 430, 932],
  ["landscape", 844, 390], ["iPad portrait", 768, 1024], ["iPad landscape", 1024, 768],
];
for (const [name, width, height] of SIZES) {
  test(`fits ${name} (${width}x${height}): no sideways scroll, controls reachable, inputs do not trigger zoom`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed: seed() });
    for (const tab of ["هذا الأسبوع", "الأطباق", "التسوق", "المصروفات"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.getByRole("button", { name: tab, exact: true })).toHaveAttribute("aria-current", "page");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tab} scrolls sideways`).toBe(true);
      // the tab bar sits at the bottom edge, fully on screen
      const nav = (await page.locator(".bottom-nav").boundingBox())!;
      expect(nav.y + nav.height).toBeCloseTo(height, 0);
      expect(nav.height).toBeGreaterThanOrEqual(height < 500 ? 38 : 49); // the compact landscape bar is shorter, as on iOS
    }
    // iOS Safari zooms in on inputs smaller than 16px
    await page.getByRole("button", { name: "التسوق", exact: true }).click();
    await page.getByRole("button", { name: /Market/ }).click();
    const small = await page.locator("input:visible, textarea:visible").evaluateAll((els) => els.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id));
    expect(small).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("swipe a shopping row: Delete reveals, a long swipe deletes, the other way ticks (English, left to right)", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "lists", seed: seed() });
  await openList(page);

  await drag(page, rowOf(page, "rice").locator(".swipe-content"), -120); // toward the trailing edge: Delete appears, nothing is deleted yet
  await expect(rowOf(page, "rice").locator(".swipe-trail")).toBeVisible();
  expect(((await stored(page, "lists"))[0].items as unknown[]).length).toBe(3);
  await page.keyboard.press("Escape"); // closes again
  await expect(rowOf(page, "rice").locator(".swipe-trail")).toBeHidden();

  await drag(page, rowOf(page, "oil").locator(".swipe-content"), -120);
  await rowOf(page, "oil").locator(".swipe-trail").click();
  await expect(page.getByLabel("1 oil")).toHaveCount(0);

  await drag(page, rowOf(page, "salt").locator(".swipe-content"), -280); // far enough: deletes at once
  await expect(page.getByLabel("1 salt")).toHaveCount(0);
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { name: string }[]).map((i) => i.name)).toEqual(["rice"]);

  await drag(page, rowOf(page, "rice").locator(".swipe-content"), 110); // toward the leading edge: ticks
  await expect(page.getByLabel("1 rice")).toBeChecked();
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { checked: boolean }[])[0].checked).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __overlaps: number }).__overlaps)).toBe(0);
});

test("swipe directions mirror in Arabic (right-to-left)", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "lists", seed: seed([item("a", "rice"), item("b", "oil")]) });
  await page.getByRole("button", { name: /Market/ }).click();

  await drag(page, rowOf(page, "rice").locator(".swipe-content"), 120); // to the right = toward the trailing edge in Arabic
  await expect(rowOf(page, "rice").locator(".swipe-trail")).toBeVisible();
  await rowOf(page, "rice").locator(".swipe-trail").click();
  await expect(page.getByLabel("1 rice")).toHaveCount(0);

  await drag(page, rowOf(page, "oil").locator(".swipe-content"), -110); // to the left = ticks
  await expect(page.getByLabel("1 oil")).toBeChecked();

  // the same swipe again undoes it
  await drag(page, rowOf(page, "oil").locator(".swipe-content"), -110);
  await expect(page.getByLabel("1 oil")).not.toBeChecked();
});

test("a short drag springs back and a tap still ticks", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "lists", seed: seed() });
  await openList(page);
  await drag(page, rowOf(page, "rice").locator(".swipe-content"), -20);
  await expect(rowOf(page, "rice").locator(".swipe-trail")).toBeHidden();
  await page.getByLabel("1 rice").check();
  await expect(page.getByLabel("1 rice")).toBeChecked();
});

test("sheets have a grabber: drag it down to dismiss; a short drag does not", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "recipes", seed: seed() });
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  const sheet = page.getByRole("dialog", { name: "Add ingredient" });
  const grab = sheet.locator(".sheet-grab");
  await page.waitForTimeout(450); // let the sheet finish rising
  const box = (await grab.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toBeVisible(); // too short
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 220, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
});

test("deleting asks in an action sheet; Cancel keeps it, the red action deletes", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "lists", seed: seed() });
  await openList(page);
  await page.getByText("More", { exact: true }).click();
  await page.getByRole("button", { name: "Delete list" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete list" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  expect((await stored(page, "lists")).length).toBe(1);
  await page.getByRole("button", { name: "Delete list" }).click();
  await page.keyboard.press("Escape"); // Escape cancels too
  expect((await stored(page, "lists")).length).toBe(1);
  await page.getByRole("button", { name: "Delete list" }).click();
  await page.getByRole("dialog", { name: "Delete list" }).getByRole("button", { name: "Delete this list" }).click();
  await expect.poll(async () => (await stored(page, "lists")).length).toBe(0);
});

test("the food form is a modal screen with Cancel and Save in its own bar, and the top bar gets a hairline on scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: seed() });
  await expect(page.locator(".top")).not.toHaveClass(/scrolled/);
  await page.evaluate(() => window.scrollTo(0, 200));
  await expect(page.locator(".top")).toHaveClass(/scrolled/);

  await page.getByRole("button", { name: "Foods", exact: true }).click();
  await page.getByRole("button", { name: "New food" }).click();
  const bar = page.locator(".modal-bar");
  await expect(bar.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Save recipe" })).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeHidden();
  await bar.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".bottom-nav")).toBeVisible();
});

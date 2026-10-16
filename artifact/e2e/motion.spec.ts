import { expect, test, type Page } from "@playwright/test";
import { openArtifact, seedList, stored } from "./harness";

const TODAY = "2026-10-14";
const lists = seedList("market", "2026-10-14", [
  { name: "tomato", price: null, checked: false, category: "Produce" },
  { name: "rice", price: null, checked: false, category: "Pantry" },
]);
const open = (page: Page, fx: "full" | "calm" | "off", lang: "en" | "ar" = "en") => openArtifact(page, { today: TODAY, lang, tab: "lists", seed: { lists }, fx });
const goList = (page: Page) => page.getByRole("button", { name: /market/ }).click();
const anim = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).animationName);

test("ticking stamps the check, moves the row to the basket, and finishing the list celebrates once", async ({ page }) => {
  await open(page, "full");
  await goList(page);
  await expect(page.locator(".complete")).toHaveCount(0);
  await page.getByLabel("1 tomato").check();
  await expect(page.locator("input.stamp:checked")).toHaveCount(1); // the row came back from the basket with the stamp
  expect(await anim(page, "input.stamp:checked")).toContain("stamp");
  await expect(page.locator(".burst")).toHaveCount(0); // not finished yet
  await page.getByLabel("1 rice").check();
  await expect(page.getByRole("status").filter({ hasText: "Shopping complete" })).toBeVisible();
  await expect(page.locator(".burst i")).toHaveCount(14);
  await expect(page.locator(".burst")).toHaveCount(0, { timeout: 4000 }); // the sparks remove themselves
  // opening a finished list again shows the banner, with no fireworks
  await page.getByRole("button", { name: /All lists/ }).click();
  await goList(page);
  await expect(page.getByText("Shopping complete")).toBeVisible();
  await expect(page.locator(".burst")).toHaveCount(0);
});

test("removing a line is instant and can be taken back", async ({ page }) => {
  await open(page, "full");
  await goList(page);
  await page.getByRole("button", { name: "Remove tomato" }).click();
  await expect(page.getByRole("status").filter({ hasText: "tomato removed" })).toBeVisible();
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as unknown[]).length).toBe(1);
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { name: string }[]).map((i) => i.name)).toEqual(["tomato", "rice"]);
  await expect(page.getByLabel("1 tomato")).toBeVisible();
  await expect(page.getByText("tomato removed")).toHaveCount(0);
});

test("the tab bar's gold marker glides to the chosen tab; the page fades in", async ({ page }) => {
  await open(page, "full");
  const x = () => page.locator(".nav-ind").evaluate((e) => e.getBoundingClientRect().x);
  const before = await x();
  await page.getByRole("button", { name: "Spending", exact: true }).click();
  await expect.poll(x).not.toBe(before);
  const target = await page.getByRole("button", { name: "Spending", exact: true }).evaluate((e) => e.getBoundingClientRect().x);
  await expect.poll(x).toBeCloseTo(target, 0);
  expect(await anim(page, ".main > section")).toBe("fade-in");
});

test("amounts roll to their new value and a changed quantity flashes", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "lists", seed: { lists: seedList("market", "2026-10-14", [{ name: "tomato", price: 120000, checked: true, category: "Produce" }]) }, fx: "full" });
  await goList(page);
  await expect(page.locator(".trip-bar .money").first()).toHaveText("₦1,200");
  await page.getByLabel("Price for tomato").fill("2500");
  await page.getByLabel("Price for tomato").press("Enter");
  await expect(page.locator(".trip-bar .money").first()).toHaveText("₦2,500");
});

test("Calm keeps fades but no sparks, ripples or springs; Off has no animation at all", async ({ page, browser }) => {
  await open(page, "calm");
  await goList(page);
  await page.getByLabel("1 tomato").check();
  await page.getByLabel("1 rice").check();
  await expect(page.getByText("Shopping complete")).toBeVisible();
  await expect(page.locator(".burst")).toHaveCount(0);
  expect(await anim(page, ".items > li")).toBe("none"); // no row slide-ins
  expect(await anim(page, ".main > section")).toBe("fade-in");

  const off = await (await browser.newContext()).newPage();
  await open(off, "off");
  await goList(off);
  for (const sel of [".main > section", ".items > li", ".progress-fill", ".nav-ind"]) {
    expect(await off.locator(sel).first().evaluate((e) => [getComputedStyle(e).animationName, getComputedStyle(e).transitionDuration].join("|")), sel).toMatch(/^none\|0s/);
  }
});

test("the Effects switch changes the level, is remembered, and works in Arabic", async ({ page }) => {
  await open(page, "full", "ar");
  await page.getByRole("button", { name: "المصروفات", exact: true }).click();
  await expect(page.getByRole("heading", { name: "المؤثرات" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-fx", "full");
  await page.getByRole("button", { name: "بلا حركة" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-fx", "off");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-fx", "off");
  await page.getByRole("button", { name: "المصروفات", exact: true }).click();
  await expect(page.getByRole("button", { name: "بلا حركة" })).toHaveAttribute("aria-pressed", "true");
});

test("a touch leaves a gold ripple that cleans itself up, and never changes what a button says", async ({ page }) => {
  await open(page, "full");
  const btn = page.getByRole("button", { name: "Spending", exact: true });
  await btn.dispatchEvent("pointerdown", { clientX: 300, clientY: 700 });
  await expect(btn.locator(".ripple")).toHaveCount(1);
  await expect(btn).toHaveAccessibleName("Spending");
  await expect(btn.locator(".ripple")).toHaveCount(0, { timeout: 3000 });
});

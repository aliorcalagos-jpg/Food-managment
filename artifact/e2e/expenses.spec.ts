import { expect, test, type Page } from "@playwright/test";
import { openArtifact, seedList, stored, type Seed } from "./harness";

const TODAY = "2026-10-14"; // Wednesday: this week is Mon Oct 12 - Sun Oct 18
const NAIRA = (n: number) => n * 100; // whole naira as kobo
const settings = (budget: number | null) => ({ meta: { settings: { lang: "en", currency: "NGN", rate: 1380, weeklyBudget: budget === null ? null : NAIRA(budget) } } });
const lists = (...parts: Record<string, unknown>[]) => ({ lists: Object.assign({}, ...parts) });
const merge = (...parts: Seed[]): Seed => Object.assign({}, ...parts);

const status = (page: Page) => page.locator("p.status");

// With a budget saved the settings panel starts collapsed; open it if it is not already.
const openSettings = async (page: Page) => {
  if (!(await page.locator("details.settings").evaluate((d: HTMLDetailsElement) => d.open))) await page.getByText("Settings", { exact: true }).click();
};

test("empty state, then a first priced trip from scratch", async ({ page }) => {
  await openArtifact(page, { today: TODAY, tab: "expenses" }); // opened from the Spending tab
  await expect(page.getByRole("button", { name: "Spending" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("No prices yet")).toBeVisible();

  await page.getByRole("button", { name: "Start a shopping trip" }).click();
  await expect(page.getByRole("heading", { name: "Shopping 2026-10-14" })).toBeVisible();
  await expect(page.getByLabel("Shopped on")).toHaveValue(TODAY);

  await page.getByLabel("Add an item").fill("rice");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("1 rice")).toBeVisible();

  // prices accept thousands separators; saved on leaving the box, as whole kobo
  await page.getByLabel("Price for rice").fill("2,500");
  await page.getByLabel("Price for rice").blur();
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { price: number }[])[0].price).toBe(250000);

  // priced but not ticked = planned, not spent
  await expect(page.getByText(/Planned ₦2,500/)).toBeVisible();
  await page.getByLabel("1 rice").check();
  await expect(page.getByText(/Bought ₦2,500/)).toBeVisible();

  await page.getByRole("button", { name: "Spending" }).click();
  await expect(page.locator(".hero")).toHaveText("₦2,500");
  await expect(page.getByText("≈ $1.81").first()).toBeVisible(); // 2500 / 1380
  await expect(page.getByText(/No weekly budget yet/)).toBeVisible();
});

for (const [name, spent, planned, label, extra] of [
  ["on track", 60000, 0, "On track", null],
  ["just under 80%", 79999, 0, "On track", null],
  ["exactly 80%", 80000, 0, "Close to the limit", null],
  ["exactly the budget", 100000, 0, "Close to the limit", null],
  ["over budget", 120000, 0, "Over budget", "Over by ₦20,000"],
  ["planned items would go over", 50000, 60000, "Close to the limit", "The planned items would take you over budget"],
] as const) {
  test(`budget status: ${name}`, async ({ page }) => {
    const items = [{ name: "bought", price: NAIRA(spent), checked: true }, ...(planned ? [{ name: "planned", price: NAIRA(planned), checked: false }] : [])];
    await openArtifact(page, { today: TODAY, tab: "expenses", seed: merge(settings(100000), lists(seedList("trip", "2026-10-13", items, "Market"))) });
    await expect(status(page)).toContainText(label);
    if (extra) await expect(page.locator(".hero-card")).toContainText(new RegExp(extra.replace(/ ₦/, "\\s*₦")));
    const meter = page.getByRole("progressbar", { name: "Weekly budget" });
    await expect(meter).toHaveAttribute("aria-valuenow", String(Math.min(100, Math.round(spent / 1000))));
    // a status is never colour alone: it has an icon and a word
    await expect(page.locator(".status-icon")).toBeVisible();
  });
}

test("which week a list counts in: Sunday and Monday, and moving the shopping date", async ({ page }) => {
  const seed = merge(
    settings(100000),
    lists(
      seedList("sat", "2026-10-11", [{ name: "x", price: NAIRA(11111), checked: true }], "Last Sunday"), // previous week
      seedList("mon", "2026-10-12", [{ name: "x", price: NAIRA(1000), checked: true }], "Monday shop"),
      seedList("sun", "2026-10-18", [{ name: "x", price: NAIRA(2000), checked: true }], "Sunday shop"),
      seedList("next", "2026-10-19", [{ name: "x", price: NAIRA(33333), checked: true }], "Next Monday"), // next week
    ),
  );
  await openArtifact(page, { today: TODAY, tab: "expenses", seed });
  await expect(page.locator(".hero")).toHaveText("₦3,000"); // Monday + Sunday only
  await expect(page.locator(".hero-card")).toContainText("Oct 12 – Oct 18, 2026");

  // open a trip from the Expenses tab and move it to next week
  await page.getByRole("button", { name: /Monday shop/ }).click();
  await expect(page.getByRole("heading", { name: "Monday shop" })).toBeVisible();
  await page.getByText("More", { exact: true }).click();
  await page.getByLabel("Shopped on").fill("2026-10-20");
  await page.getByRole("button", { name: "Spending" }).click();
  await expect(page.locator(".hero")).toHaveText("₦2,000");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.locator(".hero")).toHaveText("₦34,333"); // Next Monday + the moved trip
});

test("USD: prices typed in dollars convert once at 1380; display switches; the budget does not drift", async ({ page }) => {
  await openArtifact(page, { today: TODAY, tab: "expenses", seed: merge(settings(10000), lists(seedList("t", "2026-10-13", [{ name: "oil", price: null, checked: true }], "Market"))) });
  // a list with no prices yet is not on the Expenses tab, so go through Lists; the currency is chosen on Expenses
  await page.getByRole("button", { name: "Spending" }).click();
  await openSettings(page);
  await page.getByRole("button", { name: "US dollar ($)" }).click();
  await expect(page.getByText("No prices yet")).toBeVisible();
  await page.getByRole("button", { name: "Shopping", exact: true }).click();
  await page.getByRole("button", { name: /Market/ }).click();

  await page.getByLabel("Price for oil").fill("$2");
  await page.getByLabel("Price for oil").blur();
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { price: number }[])[0].price).toBe(276000); // 2 * 1380 * 100
  await expect(page.getByLabel("Price for oil")).toHaveValue("2");

  await page.getByRole("button", { name: "Spending" }).click();
  await expect(page.locator(".hero")).toHaveText("$2.00"); // the oil line is ticked, so it counts as spent
  await expect(page.getByText("≈ ₦2,760").first()).toBeVisible();

  // the budget box shows a rounded dollar figure; saving without editing it must not change the stored budget
  await openSettings(page);
  await expect(page.getByLabel(/Weekly budget \(\$\)/)).toHaveValue("7.25");
  await page.getByRole("button", { name: "Save" }).click();
  expect((await stored(page, "meta"))[0].weeklyBudget).toBe(1000000);

  // a real edit in dollars is converted at the rate
  await page.getByLabel(/Weekly budget \(\$\)/).fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await stored(page, "meta"))[0].weeklyBudget).toBe(1380000);
});

test("bad amounts are refused, never saved as something else", async ({ page }) => {
  await openArtifact(page, { today: TODAY, tab: "expenses", seed: merge(settings(null), lists(seedList("t", "2026-10-13", [{ name: "oil", price: null, checked: true }], "Market"))) });
  await page.getByRole("button", { name: "Spending" }).click();
  await page.getByLabel(/Weekly budget/).fill("lots");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Enter an amount like 2500 or 2,500.50")).toBeVisible();
  expect((await stored(page, "meta"))[0].weeklyBudget).toBeNull();
  await page.getByLabel("Exchange rate (naira per US dollar)").fill("0");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Enter a rate above 0")).toBeVisible();

  await page.getByRole("button", { name: "Shopping", exact: true }).click();
  await page.getByRole("button", { name: /Market/ }).click();
  await page.getByLabel("Price for oil").fill("-5");
  await page.getByLabel("Price for oil").blur();
  await expect(page.getByLabel("Price for oil")).toHaveAttribute("aria-invalid", "true");
  expect(((await stored(page, "lists"))[0].items as { price: number | null }[])[0].price).toBeNull();
});

test("the charts are drawn to scale", async ({ page }) => {
  // weeks ending Oct 12: 2,000 / 0 / 8,000 / 4,000 / 0 / 0 / 0 / 6,000 naira
  const seed = merge(
    settings(10000),
    lists(
      seedList("w1", "2026-08-26", [{ name: "x", price: NAIRA(2000), checked: true }]),
      seedList("w3", "2026-09-10", [{ name: "x", price: NAIRA(8000), checked: true }]),
      seedList("w4", "2026-09-17", [{ name: "x", price: NAIRA(4000), checked: true }]),
      seedList("w8", "2026-10-14", [{ name: "x", price: NAIRA(6000), checked: true, category: "Produce" }, { name: "y", price: NAIRA(2000), checked: true, category: "Meat & fish" }]),
    ),
  );
  await openArtifact(page, { today: TODAY, tab: "expenses", seed });

  const cols = page.locator(".col");
  await expect(cols).toHaveCount(8);
  expect(await cols.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-spent"))))).toEqual([200000, 0, 800000, 400000, 0, 0, 0, 800000]);

  // bar heights are proportional to the money, with the budget (10,000) as the top of the scale
  const heights = await page.locator(".col-bar").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  const scale = heights[2] / 8000; // px per naira
  expect(heights[0]).toBeCloseTo(2000 * scale, 0);
  expect(heights[3]).toBeCloseTo(4000 * scale, 0);
  expect(heights[7]).toBeCloseTo(8000 * scale, 0);
  expect(heights[1]).toBe(0);

  // the budget line sits at 10,000 on that same scale
  const base = await page.locator(".col-plot").first().evaluate((e) => e.getBoundingClientRect().bottom);
  const lineY = await page.locator(".budget-line").evaluate((e) => e.getBoundingClientRect().bottom);
  expect(base - lineY).toBeCloseTo(10000 * scale, 0);
  // bars are thin marks: at most 24px wide
  expect(Math.max(...(await page.locator(".col-bar").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))))).toBeLessThanOrEqual(24);

  // by aisle: 6,000 produce vs 2,000 meat
  const aisle = await page.locator(".bar-fill").evaluateAll((els) => els.map((e) => ({ s: Number(e.getAttribute("data-spent")), w: e.getBoundingClientRect().width })));
  expect(aisle.map((a) => a.s)).toEqual([600000, 200000]);
  expect(aisle[1].w / aisle[0].w).toBeCloseTo(1 / 3, 1);

  // the numbers are reachable without hovering: a table, and an accessible name on every bar
  await page.getByText("Show the numbers").click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(9);
  await expect(cols.last()).toHaveAttribute("aria-label", /Oct 12 – Oct 18, 2026: ₦8K spent/);

  // clicking an earlier week moves there
  await cols.nth(2).click();
  await expect(page.locator(".hero-card")).toContainText("Sep 7 – Sep 13, 2026");
  await expect(page.locator(".hero")).toHaveText("₦8,000");
});

test("Arabic: right-to-left, amounts stay left-to-right, and the language switch keeps the budget", async ({ page }) => {
  const seed = merge(
    { meta: { settings: { lang: "ar", currency: "NGN", rate: 1380, weeklyBudget: NAIRA(100000) } } },
    lists(seedList("t", "2026-10-13", [{ name: "أرز", price: NAIRA(85000), checked: true, category: "Pantry" }, { name: "دجاج", price: NAIRA(9000), checked: false, category: "Meat & fish" }], "سوق السبت")),
  );
  await openArtifact(page, { today: TODAY, tab: "expenses", seed, lang: "ar" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "مصروف الطعام" })).toBeVisible();
  await expect(status(page)).toContainText("قريب من الحد"); // 85% of the budget
  await expect(page.locator(".hero")).toHaveText("₦85,000");
  await expect(page.locator("bdi.money").first()).toHaveAttribute("dir", "ltr");
  await expect(page.getByText("الميزانية الأسبوعية").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /سوق السبت/ })).toBeVisible();

  // amounts typed with Arabic digits are understood
  await page.getByRole("button", { name: /سوق السبت/ }).click();
  await page.getByLabel("سعر دجاج").fill("١٢٬٥٠٠");
  await page.getByLabel("سعر دجاج").blur();
  await expect.poll(async () => ((await stored(page, "lists"))[0].items as { name: string; price: number }[]).find((i) => i.name === "دجاج")!.price).toBe(1250000);

  // switching language must not erase the budget (settings are merged, not replaced)
  await page.getByRole("button", { name: "اللغة" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect.poll(async () => (await stored(page, "meta"))[0]).toEqual({ lang: "en", currency: "NGN", rate: 1380, weeklyBudget: NAIRA(100000) });
  await page.getByRole("button", { name: "Spending" }).click();
  await expect(page.getByRole("progressbar", { name: "Weekly budget" })).toBeVisible();
});

test("settings survive a reload", async ({ page }) => {
  await openArtifact(page, { today: TODAY, tab: "expenses", seed: lists(seedList("t", "2026-10-13", [{ name: "x", price: NAIRA(1000), checked: true }])) });
  await page.getByLabel(/Weekly budget/).fill("50,000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect.poll(async () => (await stored(page, "meta"))[0].weeklyBudget).toBe(NAIRA(50000));
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Weekly budget" })).toBeVisible();
  await expect(page.locator(".facts")).toContainText("₦50,000");
});

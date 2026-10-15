import { expect, test, type Page } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const TODAY = "2026-10-14";
const rec = (title: string, ingredients: { name: string; quantity: number; unit: string }[]) => ({ title, servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients });
const filled: Seed = {
  recipes: {
    rice: rec("رز مع دجاج", [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }]),
    peas: rec("يخنة بازيلاء", []),
  },
};

const fab = (page: Page) => page.getByRole("button", { name: /Open the Pilot guide|افتح مرشد Pilot/ });
const card = (page: Page) => page.locator('[data-pilot-ui="card"]');
const ring = (page: Page) => page.getByTestId("pilot-ring");

/** The highlight sits around the control (with a little room) and does not block clicks on it. */
async function expectPointingAt(page: Page, anchor: string) {
  const target = page.locator(`[data-pilot="${anchor}"]`).first();
  await expect(target).toBeVisible();
  await expect
    .poll(async () => {
      const r = await ring(page).boundingBox();
      const t = await target.boundingBox();
      if (!r || !t) return false;
      return r.x <= t.x + 1 && r.y <= t.y + 1 && r.x + r.width >= t.x + t.width - 1 && r.y + r.height >= t.y + t.height - 1;
    }, { message: `the highlight is around ${anchor}` })
    .toBe(true);
  // click-through: what is under the middle of the ring is the control itself
  const t = (await target.boundingBox())!;
  const under = await page.evaluate(([x, y, a]) => !!document.elementFromPoint(x as number, y as number)?.closest(`[data-pilot="${a}"]`), [t.x + t.width / 2, t.y + t.height / 2, anchor] as const);
  expect(under, `${anchor} can be clicked through the highlight`).toBe(true);
}

test("the Pilot button is on every tab, also above sheets, and opens and closes", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: filled });
  for (const tab of ["This week", "Foods", "Shopping", "Spending"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(fab(page)).toBeVisible();
  }
  await page.getByRole("button", { name: "Foods", exact: true }).click();
  await page.getByRole("button", { name: "New food" }).click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await expect(page.getByRole("dialog", { name: "Add ingredient" })).toBeVisible();
  await fab(page).click(); // above the sheet
  await expect(card(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Add ingredient" })).toBeVisible(); // the sheet is still there

  // the header switch hides and shows the button
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Show the Pilot button" }).click();
  await expect(fab(page)).toHaveCount(0);
  await page.reload();
  await expect(fab(page)).toHaveCount(0); // remembered on this device
  await page.getByRole("button", { name: "Show the Pilot button" }).click();
  await expect(fab(page)).toBeVisible();
});

test("it suggests Add a dish on an empty app", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: {} });
  await fab(page).click();
  await expect(card(page).locator("li", { hasText: "Add a dish" }).getByText("Suggested")).toBeVisible();
});

test("it suggests Plan the week once there are foods with ingredients", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: filled });
  await fab(page).click();
  await expect(card(page).locator("li", { hasText: "Plan the week" }).getByText("Suggested")).toBeVisible();
});

test("Add a dish: follow the highlight with real taps, in Arabic or English, until the dish is saved", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: {} });
  await fab(page).click();
  await card(page).getByRole("button", { name: /Add a dish/ }).click();
  const step = (title: string) => expect(card(page).locator("li.now")).toHaveText(title);

  await step("Open Foods");
  await expectPointingAt(page, "nav-recipes");
  await page.getByRole("button", { name: "Foods", exact: true }).click();

  await step("Start a new food");
  await expectPointingAt(page, "new-food");
  await page.getByRole("button", { name: "New food" }).click();

  await step("Name it");
  await expectPointingAt(page, "food-title");
  await page.getByLabel("Title", { exact: true }).fill("Tomato salad");

  await step("Add an ingredient");
  await expectPointingAt(page, "add-ingredient");
  await page.getByRole("button", { name: "Add ingredient" }).click();

  await step("Pick an ingredient");
  await expectPointingAt(page, "catalog");
  await page.locator(".catalog-items").getByRole("button", { name: "tomato", exact: true }).click();

  await step("Choose how much");
  await expectPointingAt(page, "qty-chips");
  await page.getByRole("group", { name: "Quantity" }).getByRole("button", { name: "3", exact: true }).click();

  await step("Add it");
  await expectPointingAt(page, "sheet-add");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await step("Close the list");
  await expectPointingAt(page, "sheet-done");
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await step("Save the dish");
  await expectPointingAt(page, "save-food");
  await expect(card(page).locator("li.is-done")).toHaveCount(8);
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(card(page).getByText("All done. Nice work!")).toBeVisible();
  await expect(card(page).locator("li.is-done")).toHaveCount(9);
  await expect(ring(page)).toHaveCount(0);
  await expect.poll(async () => (await stored(page, "recipes")).map((r) => r.title)).toEqual(["Tomato salad"]);
});

test("Plan the week, including a picked food that has no ingredients; Take me there switches tabs", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "recipes", seed: filled });
  await fab(page).click();
  await card(page).getByRole("button", { name: /Plan the week/ }).click();
  await expect(card(page).locator("li.now")).toHaveText("Open This week");
  await card(page).getByRole("button", { name: "Take me there" }).click();
  await expect(page.getByRole("button", { name: "This week", exact: true })).toHaveAttribute("aria-current", "page");

  await expect(card(page).locator("li.now")).toHaveText("Pick your foods");
  await expectPointingAt(page, "pick-card");
  await page.getByRole("button", { name: "يخنة بازيلاء", exact: true }).click(); // has no ingredients
  await expect(card(page).locator("li.now")).toHaveText("Add the missing ingredients");
  await expectPointingAt(page, "add-ing-cta");
  // the card can sit over other foods: close it (the highlight and its note stay) to tap them
  await card(page).getByRole("button", { name: "Close the guide" }).click();
  await expect(page.locator(".pilot-callout")).toBeVisible();
  await page.getByRole("button", { name: "رز مع دجاج", exact: true }).click();
  await page.getByRole("button", { name: "يخنة بازيلاء", exact: true }).click(); // take the empty food off again
  await fab(page).click();
  await expect(card(page).locator("li.now")).toHaveText("Check the servings");
  await card(page).getByRole("button", { name: "Got it" }).click();
  await expect(card(page).locator("li.now")).toHaveText("See what to buy");
  await card(page).getByRole("button", { name: "Got it" }).click();
  await expect(card(page).locator("li.now")).toHaveText("Open your shopping list");
  await page.getByRole("button", { name: "Open shopping list" }).click();
  await expect(card(page).getByText("All done. Nice work!")).toBeVisible();
});

test("Go shopping follows ticks and prices; Track spending follows the budget", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: { ...filled, week: { "2026-10-12": { picks: [{ recipeId: "rice", servings: 4 }], listId: null } } } });
  await page.getByRole("button", { name: "Shopping", exact: true }).click(); // make sure the list exists (it is built when picks change)
  await page.getByRole("button", { name: "This week", exact: true }).click();
  await page.getByRole("button", { name: "More servings of رز مع دجاج" }).click();
  await page.getByRole("button", { name: "Less servings of رز مع دجاج" }).or(page.getByRole("button", { name: "Fewer servings of رز مع دجاج" })).click();

  await fab(page).click();
  await card(page).getByRole("button", { name: /Go shopping/ }).click();
  await expect(card(page).locator("li.now")).toHaveText("Open Shopping");
  await page.getByRole("button", { name: "Shopping", exact: true }).click();
  await expect(card(page).locator("li.now")).toHaveText("Open this week's list");
  await expectPointingAt(page, "list-card");
  await page.locator('[data-pilot="list-card"]').click();
  await expect(card(page).locator("li.now")).toHaveText("Tick what you have bought");
  await expectPointingAt(page, "tick");
  await page.locator('[data-pilot="tick"] input').check();
  await expect(card(page).locator("li.now")).toHaveText("Type the price");
  await page.locator('[data-pilot="price"] input').fill("1500");
  await page.locator('[data-pilot="price"] input').blur();
  await expect(card(page).locator("li.now")).toHaveText("Check the total");

  await card(page).getByRole("button", { name: "Back to all guides" }).or(card(page).getByRole("button", { name: "All guides" })).click();
  await card(page).getByRole("button", { name: /Track spending/ }).click();
  await card(page).getByRole("button", { name: "Take me there" }).click();
  await expect(card(page).locator("li.now")).toHaveText("Set a weekly budget");
  await page.getByLabel(/Weekly budget/).fill("20000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card(page).locator("li.now")).toHaveText("Choose naira or dollars");
});

test("Pilot only points: following the guide, skipping and stopping write nothing", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed: filled });
  const writes = () => page.evaluate(() => (window as unknown as { __writeCount: number }).__writeCount);
  const before = await writes();
  await fab(page).click();
  await card(page).getByRole("button", { name: /إضافة طبق/ }).click();
  for (let i = 0; i < 4; i++) {
    await card(page).getByRole("button", { name: "تخطَّ" }).click();
  }
  await card(page).getByRole("button", { name: "أرني" }).click();
  await card(page).getByRole("button", { name: "كل الأدلة" }).click();
  await card(page).getByRole("button", { name: /الذهاب للتسوق/ }).click();
  await card(page).getByRole("button", { name: "أغلق المرشد" }).click();
  await expect(card(page)).toHaveCount(0);
  expect(await writes()).toBe(before);
});

test("the button can be dragged, stays on screen, and is where you left it after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed: filled });
  const box = (await fab(page).boundingBox())!;
  await page.mouse.move(box.x + 26, box.y + 26);
  await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y - 300, { steps: 6 });
  await page.mouse.up();
  await expect(card(page)).toHaveCount(0); // a drag is not a tap
  const moved = (await fab(page).boundingBox())!;
  expect(moved.x).toBeLessThan(box.x - 100);
  expect(moved.y).toBeLessThan(box.y - 250);
  // far off screen is pulled back in
  await page.mouse.move(moved.x + 26, moved.y + 26);
  await page.mouse.down();
  await page.mouse.move(-500, -500, { steps: 4 });
  await page.mouse.up();
  const edge = (await fab(page).boundingBox())!;
  expect(edge.x).toBeGreaterThanOrEqual(0);
  expect(edge.y).toBeGreaterThanOrEqual(0);
  await page.reload();
  const again = (await fab(page).boundingBox())!;
  expect(Math.abs(again.x - edge.x)).toBeLessThan(2);
  expect(Math.abs(again.y - edge.y)).toBeLessThan(2);
});

const SIZES: [string, number, number][] = [["iPhone SE", 320, 568], ["iPhone 14", 390, 844], ["landscape", 844, 390], ["iPad", 820, 1024]];
for (const [name, width, height] of SIZES) {
  test(`fits ${name}: the card stays on screen, nothing scrolls sideways, the button clears the tab bar`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openArtifact(page, { today: TODAY, lang: "ar", tab: "week", seed: filled });
    const nav = (await page.locator(".bottom-nav").boundingBox())!;
    const f = (await fab(page).boundingBox())!;
    expect(f.y + f.height).toBeLessThanOrEqual(nav.y + 1);
    await fab(page).click();
    await card(page).getByRole("button", { name: /إضافة طبق/ }).click();
    const c = (await card(page).boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(width);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y + c.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

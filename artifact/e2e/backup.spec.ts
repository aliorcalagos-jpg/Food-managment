import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openArtifact, stored, type Seed } from "./harness";

const rec = (title: string, servings: number, ingredients: object[]) => ({ title, servings, tags: [], instructions: "", sourceUrl: null, ingredients });
const seed: Seed = {
  recipes: { kofta: rec("كفتة", 2, [{ name: "لحم", quantity: 1, unit: "kg" }]), rice: rec("أرز بالدجاج", 4, [{ name: "أرز", quantity: 2, unit: "cup" }]) },
  week: { "2026-10-12": { picks: [{ recipeId: "kofta", servings: 4 }], listId: "week-2026-10-12" } },
  lists: { "week-2026-10-12": { name: "تسوق", rangeStart: "2026-10-12", rangeEnd: "2026-10-18", createdAt: "2026-10-12T08:00:00.000Z", shoppedOn: "2026-10-14", items: [{ id: "لحم|kg", name: "لحم", quantity: 2, unit: "kg", category: "Meat & fish", checked: false, price: null, fromPlan: true }], dismissed: [] } },
  meta: { settings: { currency: "NGN", rate: 1380, weeklyBudget: 3000000 } },
};
const TODAY = "2026-10-14";
const goTab = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).click();

async function saveBackup(page: Page, path: string) {
  await goTab(page, "Spending");
  await expect(page.getByText("No backup yet")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export a backup file" }).click()]);
  expect(download.suggestedFilename()).toBe("meal-planner-2026-10-14.json");
  await download.saveAs(path);
  await expect(page.getByText("Backup saved.")).toBeVisible();
  await expect(page.getByText("Last backup: today")).toBeVisible();
}
async function chooseFile(page: Page, path: string) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Restore from a file" }).click()]);
  await chooser.setFiles(path);
}

test("saves everything to a file and restores it on an empty phone", async ({ page, browser }, info) => {
  const file = info.outputPath("backup.json");
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed });
  await saveBackup(page, file);
  const json = JSON.parse(readFileSync(file, "utf8"));
  expect(json.app).toBe("meal-planner");
  expect(Object.keys(json.data.recipes).sort()).toEqual(["kofta", "rice"]);
  expect(json.data.lists["week-2026-10-12"].items[0].name).toBe("لحم");

  const fresh = await (await browser.newContext()).newPage(); // another phone: its own storage
  await openArtifact(fresh, { today: TODAY, lang: "en", tab: "week" });
  await goTab(fresh, "Spending");
  await chooseFile(fresh, file);
  await expect(fresh.getByText("In this file: 2 dishes · 1 weeks · 1 lists")).toBeVisible();
  await fresh.getByRole("button", { name: "Add to what I have" }).click();
  await expect(fresh.getByText("Restored: 2 dishes · 1 weeks · 1 lists.")).toBeVisible();
  await expect.poll(async () => (await stored(fresh, "recipes")).length).toBe(2);
  expect((await stored(fresh, "lists"))[0]).toMatchObject({ name: "تسوق", items: [{ name: "لحم", quantity: 2 }] });
  expect((await stored(fresh, "week"))[0]).toMatchObject({ picks: [{ recipeId: "kofta", servings: 4 }] });
  await goTab(fresh, "Shopping");
  await expect(fresh.getByRole("button", { name: /تسوق/ })).toBeVisible();
});

test("merge keeps what is on the phone, replace makes it match the file", async ({ page, browser }, info) => {
  const file = info.outputPath("backup.json");
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed });
  await saveBackup(page, file);

  const other = await (await browser.newContext()).newPage();
  await openArtifact(other, { today: TODAY, lang: "en", tab: "week", seed: { recipes: { extra: rec("Only here", 1, []) } } });
  await goTab(other, "Spending");
  await chooseFile(other, file);
  await other.getByRole("button", { name: "Add to what I have" }).click();
  await expect.poll(async () => (await stored(other, "recipes")).length).toBe(3);

  await chooseFile(other, file);
  await other.getByRole("button", { name: "Replace everything" }).click();
  await expect(other.getByRole("dialog", { name: "Replace everything" })).toBeVisible(); // asks first
  expect((await stored(other, "recipes")).length).toBe(3);
  await other.getByRole("button", { name: "Yes, replace everything" }).click();
  await expect.poll(async () => (await stored(other, "recipes")).length).toBe(2);
});

test("a file that is not a backup is refused and nothing is written", async ({ page }, info) => {
  await openArtifact(page, { today: TODAY, lang: "en", tab: "week", seed });
  await goTab(page, "Spending");
  const bad = info.outputPath("bad.json");
  writeFileSync(bad, JSON.stringify({ hello: "world" }));
  await chooseFile(page, bad);
  await expect(page.getByRole("alert").filter({ hasText: "not a Meal Planner backup" })).toBeVisible();
  expect((await stored(page, "recipes")).length).toBe(2);
  expect(await page.evaluate(() => (window as unknown as { __writeCount: number }).__writeCount)).toBe(0);
});

test("Arabic backup card", async ({ page }) => {
  await openArtifact(page, { today: TODAY, lang: "ar", tab: "expenses", seed });
  await expect(page.getByRole("heading", { name: "النسخ الاحتياطي" })).toBeVisible();
  await expect(page.getByText("لا توجد نسخة احتياطية بعد")).toBeVisible();
});

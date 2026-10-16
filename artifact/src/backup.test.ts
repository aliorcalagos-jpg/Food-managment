import { describe, expect, it } from "vitest";
import { backupFileName, buildBackup, daysSince, parseBackup, planImport, type Everything } from "./backup";
import { DEFAULT_SETTINGS } from "./model";

const all: Everything = {
  recipes: [{ id: "r1", title: "كفتة", servings: 2, tags: [], instructions: "", sourceUrl: null, ingredients: [{ name: "لحم", quantity: 1, unit: "kg" }] }],
  weeks: [{ weekStart: "2026-10-12", picks: [{ recipeId: "r1", servings: 4 }], listId: "week-2026-10-12" }],
  lists: [{ id: "week-2026-10-12", name: "Shopping", rangeStart: "2026-10-12", rangeEnd: "2026-10-18", createdAt: "2026-10-12T08:00:00.000Z", shoppedOn: "2026-10-14", items: [{ id: "لحم|kg", name: "لحم", quantity: 2, unit: "kg", category: "Meat & fish", checked: true, price: 450000, fromPlan: true }], dismissed: ["x|"] }],
  settings: { lang: "ar", currency: "USD", rate: 1380, weeklyBudget: 5000000 },
};
const now = new Date("2026-10-16T10:00:00Z");

describe("backup file", () => {
  it("round-trips everything", () => {
    const text = JSON.stringify(buildBackup(all, now));
    const r = parseBackup(text);
    expect(r.ok && r.counts).toEqual({ recipes: 1, weeks: 1, lists: 1 });
    if (!r.ok) throw new Error("not ok");
    expect(r.backup.data.recipes.r1).toMatchObject({ title: "كفتة", servings: 2 });
    expect(r.backup.data.lists["week-2026-10-12"]).toMatchObject({ dismissed: ["x|"], items: [{ price: 450000, checked: true }] });
    expect(r.backup.data.week["2026-10-12"]).toEqual({ picks: [{ recipeId: "r1", servings: 4 }], listId: "week-2026-10-12" });
    expect(r.backup.data.meta.settings).toMatchObject({ currency: "USD", weeklyBudget: 5000000 });
  });
  it("rejects what is not a backup, and a backup from a newer app", () => {
    expect(parseBackup("nope")).toEqual({ ok: false, error: "notJson" });
    expect(parseBackup("[]")).toEqual({ ok: false, error: "notBackup" });
    expect(parseBackup(JSON.stringify({ app: "other", version: 1, data: {} }))).toEqual({ ok: false, error: "notBackup" });
    expect(parseBackup(JSON.stringify({ app: "meal-planner", version: 99, data: {} }))).toEqual({ ok: false, error: "tooNew" });
  });
  it("cleans damaged documents instead of trusting them", () => {
    const r = parseBackup(JSON.stringify({ app: "meal-planner", version: 1, data: { recipes: { a: { title: 5, servings: "x", ingredients: [1, null] }, b: "bad" }, lists: null } }));
    if (!r.ok) throw new Error("not ok");
    expect(Object.keys(r.backup.data.recipes)).toEqual(["a"]);
    expect(r.backup.data.recipes.a).toMatchObject({ title: "Untitled", servings: 1 });
    for (const i of r.backup.data.recipes.a.ingredients as { name: unknown; quantity: unknown }[]) expect([typeof i.name, typeof i.quantity]).toEqual(["string", "number"]);
    expect(r.counts.lists).toBe(0);
  });
  it("names the file by date", () => expect(backupFileName(now)).toBe("meal-planner-2026-10-16.json"));
});

describe("planImport", () => {
  const backup = (() => {
    const r = parseBackup(JSON.stringify(buildBackup(all, now)));
    if (!r.ok) throw new Error("not ok");
    return r.backup;
  })();
  const phone: Everything = {
    recipes: [{ id: "r9", title: "Other", servings: 1, tags: [], instructions: "", sourceUrl: null, ingredients: [] }, all.recipes[0]],
    weeks: [{ weekStart: "2026-10-05", picks: [], listId: null }],
    lists: [],
    settings: { ...DEFAULT_SETTINGS, lang: "en" },
  };
  it("merge adds and replaces by id and deletes nothing", () => {
    const ops = planImport(backup, phone, "merge");
    expect(ops.some((o) => o.data === null)).toBe(false);
    expect(ops.map((o) => `${o.name}/${o.id}`)).toEqual(["recipes/r1", "week/2026-10-12", "lists/week-2026-10-12", "meta/settings"]);
  });
  it("replace also deletes what the file does not have", () => {
    const deleted = planImport(backup, phone, "replace").filter((o) => o.data === null).map((o) => `${o.name}/${o.id}`);
    expect(deleted).toEqual(["recipes/r9", "week/2026-10-05"]);
  });
  it("keeps this device's language but takes the money settings", () => {
    const s = planImport(backup, phone, "merge").find((o) => o.name === "meta")!.data!;
    expect(s).toMatchObject({ lang: "en", currency: "USD", weeklyBudget: 5000000 });
  });
});

describe("daysSince", () => {
  it("counts whole days and tolerates missing or bad values", () => {
    expect(daysSince("2026-10-10T10:00:00Z", now)).toBe(6);
    expect(daysSince("2026-10-16T09:00:00Z", now)).toBe(0);
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince("garbage", now)).toBeNull();
  });
});

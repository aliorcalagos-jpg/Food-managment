import { describe, expect, it } from "vitest";
import type { ListItem, ShoppingList } from "./model";
import { averageSpend, budgetStatus, history, listTotals, weekOf, weekSummary } from "./spending";

let n = 0;
const item = (price: number | null, checked: boolean, category: string | null = "Pantry"): ListItem => ({
  id: `i${n++}`, name: "x", quantity: 1, unit: "", category, checked, price,
});
const list = (id: string, shoppedOn: string, items: ListItem[], name = id): ShoppingList => ({
  id, name, rangeStart: null, rangeEnd: null, createdAt: "2026-10-01T00:00:00Z", shoppedOn, items,
});

describe("weekOf", () => {
  it.each([
    ["2026-10-12", "2026-10-12"], // Monday
    ["2026-10-18", "2026-10-12"], // Sunday belongs to the week that started Monday
    ["2026-10-19", "2026-10-19"], // the next Monday starts a new week
    ["2027-01-01", "2026-12-28"],
  ])("%s -> %s", (d, w) => expect(weekOf(d)).toBe(w));
  it("is null for anything that is not a real date", () => {
    expect(weekOf("")).toBeNull();
    expect(weekOf("2026-02-30")).toBeNull();
  });
});

describe("listTotals", () => {
  it("counts priced ticked items as spent, priced unticked as planned, and unpriced separately", () => {
    expect(listTotals(list("a", "2026-10-12", [item(1000, true), item(500, true), item(700, false), item(null, true), item(null, false), item(0, true)]))).toEqual({
      spent: 1500, planned: 700, unpriced: 2,
    });
  });
});

describe("weekSummary", () => {
  const lists = [
    list("mon", "2026-10-12", [item(10000, true, "Produce"), item(5000, true, "Meat & fish"), item(2000, false, "Produce")], "Monday shop"),
    list("sun", "2026-10-18", [item(3000, true, "Produce")], "Sunday shop"),
    list("next", "2026-10-19", [item(99999, true)], "Next week"), // Monday after: another week
    list("prev", "2026-10-11", [item(88888, true)], "Previous week"), // Sunday before
    list("undated", "", [item(777, true)]),
    list("empty", "2026-10-14", [item(null, true)]),
  ];
  const w = weekSummary(lists, "2026-10-12");

  it("includes Monday through Sunday and nothing from the neighbouring weeks", () => {
    expect(w.spent).toBe(18000);
    expect(w.planned).toBe(2000);
    expect(w.trips.map((t) => t.name)).toEqual(["Sunday shop", "Monday shop"]); // newest first
  });
  it("splits bought spending by aisle, biggest first, and ignores planned items there", () => {
    expect(w.byAisle).toEqual([{ category: "Produce", spent: 13000 }, { category: "Meat & fish", spent: 5000 }]);
  });
  it("splits bought spending by weekday, Monday first", () => {
    expect(w.byDay).toEqual([15000, 0, 0, 0, 0, 0, 3000]);
  });
  it("skips lists with no price at all, and puts unknown aisles under Other", () => {
    expect(w.trips.find((t) => t.listId === "empty")).toBeUndefined();
    expect(weekSummary([list("a", "2026-10-12", [item(100, true, null)])], "2026-10-12").byAisle).toEqual([{ category: "Other", spent: 100 }]);
  });
  it("is all zeros for a week with nothing", () => {
    expect(weekSummary(lists, "2026-11-02")).toMatchObject({ spent: 0, planned: 0, trips: [] });
  });
});

describe("history / averageSpend", () => {
  const lists = [list("a", "2026-10-05", [item(1000, true)]), list("b", "2026-10-12", [item(3000, true)]), list("c", "2026-10-14", [item(2000, true), item(900, false)])];
  it("returns n weeks oldest first, including empty ones", () => {
    const h = history(lists, "2026-10-12", 4);
    expect(h.map((x) => x.weekStart)).toEqual(["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(h.map((x) => x.spent)).toEqual([0, 0, 1000, 5000]);
    expect(h[3].planned).toBe(900);
  });
  it("defaults to eight weeks and handles a bad end date", () => {
    expect(history(lists, "2026-10-12")).toHaveLength(8);
    expect(history(lists, "nope")).toEqual([]);
  });
  it("averages only the weeks that had spending", () => {
    expect(averageSpend(history(lists, "2026-10-12", 4))).toBe(3000);
    expect(averageSpend([{ spent: 0 }])).toBeNull();
  });
  it("rounds the average to whole naira, not kobo", () => {
    expect(averageSpend([{ spent: 1_000_000 }, { spent: 1_000_000 }, { spent: 1_000_100 }])).toBe(1_000_000); // 10,000.33 naira -> 10,000
    expect(averageSpend([{ spent: 100_000 }, { spent: 150_100 }])).toBe(125_100); // 1,250.50 -> 1,251
  });
});

describe("budgetStatus", () => {
  const B = 100000;
  it.each([
    [0, 0, "ok"],
    [79999, 0, "ok"],
    [80000, 0, "warn"], // exactly 80%
    [99999, 0, "warn"],
    [100000, 0, "warn"], // exactly the budget: nothing left, but not over
    [100001, 0, "over"],
    [50000, 50000, "ok"], // planned fits exactly
    [50000, 50001, "warn"], // planned would take it over
    [120000, 0, "over"],
  ])("spent %s, planned %s -> %s", (spent, planned, state) => expect(budgetStatus(spent, planned, B).state).toBe(state));

  it("reports what is left, the projection and the percent", () => {
    expect(budgetStatus(60000, 25000, B)).toEqual({ state: "ok", left: 40000, projectedLeft: 15000, percent: 60, projectedOver: false });
    expect(budgetStatus(120000, 0, B)).toMatchObject({ left: -20000, percent: 120 });
    expect(budgetStatus(50000, 60000, B)).toMatchObject({ projectedOver: true, projectedLeft: -10000 });
  });
  it("has no state without a budget", () => {
    expect(budgetStatus(5000, 0, null).state).toBe("none");
    expect(budgetStatus(5000, 0, 0).state).toBe("none");
  });
});

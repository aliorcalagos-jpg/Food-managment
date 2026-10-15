import { describe, expect, it } from "vitest";
import { addDays, parseISODate, resolveWeekStart, startOfWeek, toISODate, weekDays } from "./week";

const d = (s: string) => parseISODate(s)!;

describe("parseISODate", () => {
  it("parses real dates to UTC midnight", () => {
    expect(d("2026-10-14").toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(d("2028-02-29").toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });
  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-1-5", "10/14/2026", "", "2026-10-14T00:00", "abcd-ef-gh"])(
    "rejects %j",
    (s) => expect(parseISODate(s)).toBeNull(),
  );
});

describe("startOfWeek (Monday)", () => {
  it.each([
    ["2026-10-12", "2026-10-12"], // Monday stays
    ["2026-10-14", "2026-10-12"], // Wednesday
    ["2026-10-18", "2026-10-12"], // Sunday belongs to the week that began Monday
    ["2026-10-19", "2026-10-19"], // next Monday
    ["2027-01-01", "2026-12-28"], // across a year boundary
    ["2028-03-01", "2028-02-28"], // across a leap day
  ])("%s -> %s", (input, expected) => expect(toISODate(startOfWeek(d(input)))).toBe(expected));

  it("ignores time of day", () => {
    expect(toISODate(startOfWeek(new Date("2026-10-18T23:59:59.999Z")))).toBe("2026-10-12");
  });
});

describe("weekDays / addDays", () => {
  it("returns Monday..Sunday", () => {
    expect(weekDays(d("2026-10-12")).map(toISODate)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
  });
  it("is unaffected by DST changes", () => {
    expect(toISODate(addDays(d("2026-03-07"), 1))).toBe("2026-03-08");
    expect(toISODate(addDays(d("2026-10-31"), 1))).toBe("2026-11-01");
    expect(weekDays(d("2026-10-26")).map(toISODate)[6]).toBe("2026-11-01");
  });
  it("does not mutate its input", () => {
    const x = d("2026-10-12");
    addDays(x, 3);
    expect(toISODate(x)).toBe("2026-10-12");
  });
});

describe("resolveWeekStart", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  it("uses the given week, normalised to Monday", () => {
    expect(toISODate(resolveWeekStart("2026-10-21", now))).toBe("2026-10-19");
  });
  it("falls back to the current week for missing or invalid input", () => {
    for (const bad of [undefined, "", "nonsense", "2026-02-30"]) {
      expect(toISODate(resolveWeekStart(bad, now))).toBe("2026-10-12");
    }
  });
});

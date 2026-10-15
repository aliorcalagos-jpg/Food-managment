import { describe, expect, it } from "vitest";
import { editableAmount, formatMoney, formatMoneyCompact, majorUnits, parseAmount, parseMoney, toKobo } from "./money";

describe("parseAmount", () => {
  it.each([
    ["2500", 2500],
    ["2,500", 2500],
    ["1,380", 1380],
    ["1,380,000", 1380000],
    ["1.380.000", 1380000],
    ["2500.50", 2500.5],
    ["2,500.50", 2500.5],
    ["2.500,50", 2500.5],
    ["1,5", 1.5],
    ["1,50", 1.5],
    ["0.99", 0.99],
    [".5", 0.5],
    ["1.380", 1.38], // one dot is a decimal mark, not a thousands separator
    [" 2 500 ", 2500],
    ["₦2,500", 2500],
    ["$12.99", 12.99],
    ["NGN 2500", 2500],
    ["usd1.5", 1.5],
    // Arabic digits and marks
    ["٢٥٠٠", 2500],
    ["٢٬٥٠٠", 2500],
    ["١٣٨٠٫٥٠", 1380.5],
    ["٢،٥٠٠", 2500],
    ["۱۲۳", 123], // Persian digits
  ])("reads %j as %s", (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(["", "  ", "abc", "-5", "1,2,3", "1,2345", "1..5", "5-", "12abc", "1e3", "١٢ جنيه", "0x10", "1,380.5.2"])(
    "rejects %j",
    (input) => expect(parseAmount(input)).toBeNull(),
  );

  it("rejects absurd amounts instead of overflowing", () => {
    expect(parseAmount("99999999999999")).toBeNull();
    expect(parseAmount("9999999999")).toBe(9999999999); // 1e10 naira is still within 1e12 kobo
  });
});

describe("toKobo / parseMoney", () => {
  it("stores naira as whole kobo", () => {
    expect(toKobo(2500, "NGN")).toBe(250000);
    expect(toKobo(0.1 + 0.2, "NGN")).toBe(30); // no float drift
    expect(parseMoney("2,500.5", "NGN")).toBe(250050);
  });

  it("converts a typed dollar amount once, at the fixed rate", () => {
    expect(toKobo(1, "USD")).toBe(138000);
    expect(toKobo(19.99, "USD")).toBe(2758620); // 19.99 * 1380 = 27,586.20 naira
    expect(toKobo(0.01, "USD")).toBe(1380);
    expect(parseMoney("$2", "USD", 1500)).toBe(300000); // a different rate is respected
  });

  it("returns null for unreadable input or overflow", () => {
    expect(parseMoney("lots", "NGN")).toBeNull();
    expect(parseMoney("9999999999", "USD")).toBeNull(); // 9,999,999,999 USD is more than the cap in naira
  });
});

describe("formatMoney / majorUnits / editableAmount", () => {
  it("formats naira without decimals when whole, and with them otherwise", () => {
    expect(formatMoney(250000, "NGN")).toBe("₦2,500");
    expect(formatMoney(250050, "NGN")).toBe("₦2,500.5");
    expect(formatMoney(0, "NGN")).toBe("₦0");
    expect(formatMoney(138000000, "NGN")).toBe("₦1,380,000");
  });
  it("formats dollars at the fixed rate with two decimals", () => {
    expect(formatMoney(138000, "USD")).toBe("$1.00");
    expect(formatMoney(250000, "USD")).toBe("$1.81"); // 2500 / 1380 = 1.8116
    expect(formatMoney(250000, "USD", 1500)).toBe("$1.67");
  });
  it("always uses Western digits, whatever the page language", () => {
    expect(formatMoney(123456789, "NGN")).toMatch(/^₦[0-9,.]+$/);
  });
  it("round-trips what you typed through the edit box", () => {
    for (const [typed, cur] of [["2500", "NGN"], ["1,380.5", "NGN"], ["$1.81", "USD"]] as const) {
      const kobo = parseMoney(typed, cur)!;
      expect(parseMoney(editableAmount(kobo, cur), cur)).toBe(kobo);
    }
  });
  it("major units are exact for naira and divide by the rate for dollars", () => {
    expect(majorUnits(250000, "NGN")).toBe(2500);
    expect(majorUnits(138000, "USD")).toBe(1);
  });
});

describe("formatMoneyCompact", () => {
  it("shortens big amounts and keeps small ones exact", () => {
    expect(formatMoneyCompact(0, "NGN")).toBe("₦0");
    expect(formatMoneyCompact(95000, "NGN")).toBe("₦950");
    expect(formatMoneyCompact(1_200_000, "NGN")).toBe("₦12K");
    expect(formatMoneyCompact(125_000_000, "NGN")).toBe("₦1.3M");
    expect(formatMoneyCompact(138_000_000, "USD")).toBe("$1K");
  });
});

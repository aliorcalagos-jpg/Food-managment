import { describe, expect, it } from "vitest";
import { formatQuantity, parseQuantity } from "./quantity";

describe("parseQuantity", () => {
  it.each([
    ["2", 2],
    ["0.5", 0.5],
    [".5", 0.5],
    ["1,5", 1.5],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    ["  3  ", 3],
  ])("parses %s", (input, expected) => expect(parseQuantity(input)).toBe(expected));

  it.each(["", "abc", "0", "-1", "1/0", "1 1/0", "1/2/3", "1e3", "Infinity"])("rejects %j", (input) =>
    expect(parseQuantity(input)).toBeNull(),
  );
});

describe("formatQuantity", () => {
  it.each([
    [2, "2"],
    [0.5, "1/2"],
    [1.5, "1 1/2"],
    [1 / 3, "1/3"],
    [2 / 3, "2/3"],
    [0.125, "1/8"],
    [2.75, "2 3/4"],
    [0.3, "0.3"],
    [1.234567, "1.23"],
  ])("formats %s as %s", (n, expected) => expect(formatQuantity(n)).toBe(expected));

  it("round-trips through parseQuantity without losing value", () => {
    for (const n of [1 / 3, 2 / 3, 0.5, 1.5, 0.125, 2.75, 5, 0.3, 1.2]) {
      expect(parseQuantity(formatQuantity(n))).toBeCloseTo(n, 2);
    }
    // fractions are exact on repeated edit cycles
    let n = 1 / 3;
    for (let i = 0; i < 5; i++) n = parseQuantity(formatQuantity(n))!;
    expect(n).toBe(1 / 3);
  });
});

describe("parseQuantity with Arabic input", () => {
  it.each([
    ["٢", 2],
    ["٠٫٥", 0.5],
    ["٢،٥", 2.5],
    ["١/٢", 0.5],
    ["١ ١/٢", 1.5],
    ["۳", 3],
  ])("parses %s", (input, expected) => expect(parseQuantity(input)).toBe(expected));
  it("still rejects junk and zero", () => {
    expect(parseQuantity("كثير")).toBeNull();
    expect(parseQuantity("٠")).toBeNull();
  });
});
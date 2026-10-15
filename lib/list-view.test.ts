import { describe, expect, it } from "vitest";
import { groupItems } from "./list-service";
import { addItemSchema, generateListSchema, toggleItemSchema } from "./validation";

const item = (name: string, category: string | null, checked = false) => ({
  id: name, name, quantity: 1, unit: "", checked, category,
});

describe("groupItems", () => {
  it("orders categories by aisle, unchecked first then alphabetical, unknown -> Other", () => {
    const groups = groupItems([
      item("soap", "Other"),
      item("milk", "Dairy & eggs"),
      item("kale", "Produce", true),
      item("apple", "Produce"),
      item("banana", "Produce"),
      item("mystery", null),
      item("weird", "Not A Category"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Produce", "Dairy & eggs", "Other"]);
    expect(groups[0].items.map((i) => i.name)).toEqual(["apple", "banana", "kale"]);
    expect(groups[2].items.map((i) => i.name)).toEqual(["mystery", "soap", "weird"]);
  });
  it("omits empty categories", () => {
    expect(groupItems([])).toEqual([]);
  });
});

describe("generateListSchema", () => {
  const ok = { name: "", start: "2027-03-01", end: "2027-03-07" };
  it("accepts a valid range and blanks the name", () => {
    expect(generateListSchema.parse(ok)).toEqual({ name: undefined, start: "2027-03-01", end: "2027-03-07" });
  });
  it("accepts a single day", () => {
    expect(generateListSchema.safeParse({ ...ok, end: "2027-03-01" }).success).toBe(true);
  });
  it("rejects end before start, bad dates and huge ranges", () => {
    expect(generateListSchema.safeParse({ ...ok, end: "2027-02-28" }).success).toBe(false);
    expect(generateListSchema.safeParse({ ...ok, start: "2027-02-30" }).success).toBe(false);
    expect(generateListSchema.safeParse({ ...ok, end: "2027-12-31" }).success).toBe(false);
    // exactly 62 days is allowed, 63 is not
    expect(generateListSchema.safeParse({ ...ok, start: "2027-03-01", end: "2027-05-01" }).success).toBe(true);
    expect(generateListSchema.safeParse({ ...ok, start: "2027-03-01", end: "2027-05-02" }).success).toBe(false);
  });
});

describe("addItemSchema", () => {
  const base = { listId: "l1", name: " Milk ", unit: "" };
  it("defaults the quantity to 1 and understands fractions", () => {
    expect(addItemSchema.parse({ ...base, quantity: "" }).quantity).toBe(1);
    expect(addItemSchema.parse({ ...base, quantity: "1 1/2" }).quantity).toBe(1.5);
    expect(addItemSchema.parse({ ...base, quantity: "2" }).name).toBe("Milk");
  });
  it("rejects bad quantities and empty names", () => {
    expect(addItemSchema.safeParse({ ...base, quantity: "lots" }).success).toBe(false);
    expect(addItemSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
    expect(addItemSchema.safeParse({ ...base, name: " ", quantity: "1" }).success).toBe(false);
  });
});

describe("toggleItemSchema", () => {
  it("parses only true/false", () => {
    expect(toggleItemSchema.parse({ itemId: "i", checked: "true" }).checked).toBe(true);
    expect(toggleItemSchema.parse({ itemId: "i", checked: "false" }).checked).toBe(false);
    expect(toggleItemSchema.safeParse({ itemId: "i", checked: "yes" }).success).toBe(false);
  });
});

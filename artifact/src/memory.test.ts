import { describe, expect, it } from "vitest";
import { buildMemory, memoryKey, withRows } from "./memory";
import type { Recipe } from "./model";

const dish = (id: string, ingredients: { name: string; quantity: number; unit: string }[]): Recipe => ({ id, title: id, servings: 4, tags: [], instructions: "", sourceUrl: null, ingredients });

describe("memory", () => {
  const recipes = [
    dish("a", [{ name: "أرز", quantity: 2, unit: "كوب" }, { name: "دجاج", quantity: 1, unit: "كيلو" }, { name: "بصل", quantity: 2, unit: "" }]),
    dish("b", [{ name: "رز", quantity: 1.5, unit: "كوب" }, { name: "طماطم", quantity: 3, unit: "" }, { name: "بصل", quantity: 1, unit: "" }]),
    dish("c", [{ name: "الأرز", quantity: 3, unit: "كوب" }, { name: "بصل", quantity: 1, unit: "" }]),
  ];
  it("remembers the latest amount per ingredient, whichever way it is spelled", () => {
    const m = buildMemory(recipes);
    expect(m.last.get(memoryKey("أرز"))).toEqual({ quantity: "3", unit: "كوب" });
    expect(m.last.get(memoryKey("رز"))).toEqual({ quantity: "3", unit: "كوب" });
    expect(m.last.get(memoryKey("طماطم"))).toEqual({ quantity: "3", unit: "" });
    expect(m.last.get(memoryKey("ملح"))).toBeUndefined();
  });
  it("ranks the most used ingredients first, one count per dish, first spelling kept", () => {
    expect(buildMemory(recipes).often).toEqual(["أرز", "بصل", "دجاج", "طماطم"]);
  });
  it("limits the list and ignores rows with no name or no quantity", () => {
    const many = [dish("x", Array.from({ length: 20 }, (_, i) => ({ name: `item ${i}`, quantity: 1, unit: "" })))];
    expect(buildMemory(many, 12).often).toHaveLength(12);
    const m = buildMemory([dish("y", [{ name: "salt", quantity: 0, unit: "tsp" }, { name: " ", quantity: 1, unit: "" }])]);
    expect(m.last.size).toBe(0);
    expect(m.often).toEqual(["salt"]);
  });
  it("counts what is being entered right now as the newest", () => {
    const m = withRows(buildMemory(recipes), [{ name: "طماطم", quantity: "5", unit: "" }, { name: "ملح", quantity: "1", unit: "ملعقة صغيرة" }]);
    expect(m.last.get(memoryKey("طماطم"))).toEqual({ quantity: "5", unit: "" });
    expect(m.last.get(memoryKey("ملح"))).toEqual({ quantity: "1", unit: "ملعقة صغيرة" });
    expect(m.often).toContain("ملح");
  });
});

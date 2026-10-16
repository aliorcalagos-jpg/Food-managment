import { describe, expect, it } from "vitest";
import { aisleSummary, buildListItems, itemKey, sourcesByItem } from "./list-build";
import { massGrams, tidyAmount } from "./ingredients";

const pasta = {
  servings: 4,
  ingredients: [
    { name: "Spaghetti", quantity: 400, unit: "g" },
    { name: "milk", quantity: 2, unit: "cup" },
    { name: "tomatoes", quantity: 3, unit: "" },
  ],
};
const bake = { servings: 2, ingredients: [{ name: "spaghetti", quantity: 1, unit: "kg" }] };

describe("buildListItems", () => {
  it("scales to planned servings, merges across meals and tags aisles", () => {
    const items = buildListItems([
      { servings: 2, recipe: pasta }, // half: 200 g, 1 cup, 1.5 tomatoes
      { servings: 4, recipe: pasta }, // as written: 400 g, 2 cup, 3 tomatoes
      { servings: 2, recipe: bake }, // 1 kg
    ]);
    expect(items).toEqual([
      { name: "milk", quantity: 3, unit: "cup", category: "Dairy & eggs" },
      { name: "spaghetti", quantity: 1.6, unit: "kg", category: "Pantry" },
      { name: "tomatoes", quantity: 4.5, unit: "", category: "Produce" },
    ]);
  });

  it("returns nothing for no meals", () => {
    expect(buildListItems([])).toEqual([]);
  });
});

describe("which foods need each line", () => {
  const meal = (title: string, servings: number, ingredients: { name: string; quantity: number; unit: string }[]) => ({ title, servings, recipe: { servings, ingredients } });
  const kofta = meal("Kofta", 2, [{ name: "Beef", quantity: 1, unit: "kg" }, { name: "Onion", quantity: 2, unit: "" }]);
  const stew = meal("Stew", 4, [{ name: "beef", quantity: 500, unit: "g" }, { name: "Beef", quantity: 250, unit: "g" }]);

  it("lists each food with its own amount, adding up repeats inside one food", () => {
    const s = sourcesByItem([kofta, stew]).get(itemKey("beef", "kg"))!;
    expect(s).toEqual([
      { title: "Kofta", servings: 2, quantity: 1, unit: "kg" },
      { title: "Stew", servings: 4, quantity: 750, unit: "g" },
    ]);
    expect(sourcesByItem([kofta, stew]).get(itemKey("onion", ""))!.map((x) => x.title)).toEqual(["Kofta"]);
  });
  it("scales to the servings planned", () => {
    expect(sourcesByItem([{ ...kofta, servings: 4 }]).get(itemKey("beef", "g"))![0].quantity).toBe(2);
  });
  it("sums the weight of meat sold by weight and counts the rest", () => {
    const items = [{ name: "Beef", quantity: 1.5, unit: "kg" }, { name: "chicken", quantity: 500, unit: "g" }, { name: "sausage", quantity: 4, unit: "" }];
    const sourcesOf = (i: { name: string }) => (i.name === "Beef" ? [{ title: "A", servings: 1, quantity: 1, unit: "kg" }, { title: "B", servings: 1, quantity: 0.5, unit: "kg" }] : [{ title: "B", servings: 1, quantity: 1, unit: "g" }]);
    expect(aisleSummary(items, sourcesOf)).toEqual({ dishes: 2, grams: 2000, byCount: 1 });
    expect(aisleSummary([{ name: "x", quantity: 2, unit: "" }], () => [])).toEqual({ dishes: 0, grams: null, byCount: 1 });
  });
  it("shows big weights the way they are bought", () => {
    expect(tidyAmount(1500, "g")).toEqual({ quantity: 1.5, unit: "kg" });
    expect(tidyAmount(2000, "ml")).toEqual({ quantity: 2, unit: "l" });
    expect(tidyAmount(750, "g")).toEqual({ quantity: 750, unit: "g" });
    expect(tidyAmount(1500, "كوب")).toEqual({ quantity: 1500, unit: "كوب" });
    expect(massGrams(2, "kg")).toBe(2000);
    expect(massGrams(1, "كيلو")).toBe(1000);
    expect(massGrams(3, "")).toBeNull();
  });
});

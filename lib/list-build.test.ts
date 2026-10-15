import { describe, expect, it } from "vitest";
import { buildListItems } from "./list-build";

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

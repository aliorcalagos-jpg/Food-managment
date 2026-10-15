import { describe, expect, it } from "vitest";
import { categorize } from "./categories";

describe("categorize", () => {
  it.each([
    // compounds beat the words they contain
    ["peanut butter", "Pantry"],
    ["coconut milk", "Pantry"],
    ["almond milk", "Pantry"],
    ["tomato paste", "Pantry"],
    ["chicken stock", "Pantry"],
    ["olive oil", "Pantry"],
    ["garlic powder", "Pantry"],
    ["black pepper", "Pantry"],
    ["pepper", "Pantry"],
    ["bread crumbs", "Pantry"],
    ["egg noodles", "Pantry"],
    ["soy sauce", "Pantry"],
    ["ice cream", "Frozen"],
    // plain words
    ["milk", "Dairy & eggs"],
    ["butter", "Dairy & eggs"],
    ["eggs", "Dairy & eggs"],
    ["parmesan", "Dairy & eggs"],
    ["chicken breast", "Meat & fish"],
    ["salmon", "Meat & fish"],
    ["shrimp", "Meat & fish"],
    ["bacon", "Meat & fish"],
    ["bread", "Bakery"],
    ["tortillas", "Bakery"],
    ["tomatoes", "Produce"],
    ["tomato", "Produce"],
    ["bell pepper", "Produce"],
    ["red onion", "Produce"],
    ["garlic", "Produce"],
    ["strawberries", "Produce"],
    ["blueberry", "Produce"],
    ["berries", "Produce"],
    ["lemon", "Produce"],
    ["fresh basil", "Produce"],
    ["flour", "Pantry"],
    ["spaghetti", "Pantry"],
    ["red lentils", "Pantry"],
    ["salt", "Pantry"],
    // unknown
    ["paper towels", "Other"],
    ["dragon", "Other"],
    ["", "Other"],
  ])("%j -> %s", (name, expected) => expect(categorize(name)).toBe(expected));

  it("is case- and whitespace-insensitive", () => {
    expect(categorize("  Olive OIL ")).toBe("Pantry");
  });
});

describe("categorize Arabic", () => {
  it.each([
    // the ingredients of the user's own dishes
    ["طماطم", "Produce"],
    ["بطاطس", "Produce"],
    ["بازيلاء", "Produce"],
    ["بامياء", "Produce"],
    ["بامية", "Produce"],
    ["فاصولياء", "Produce"],
    ["بصل", "Produce"],
    ["رز", "Pantry"],
    ["أرز", "Pantry"],
    ["الأرز", "Pantry"],
    ["دجاج", "Meat & fish"],
    ["كفتة", "Meat & fish"],
    ["لحم مفروم", "Meat & fish"],
    // compounds beat the words they contain
    ["معجون طماطم", "Pantry"],
    ["زيت زيتون", "Pantry"],
    ["فاصولياء بيضاء", "Pantry"],
    ["بازيلاء مجمدة", "Frozen"],
    ["حليب", "Dairy & eggs"],
    ["بيض", "Dairy & eggs"],
    ["خبز", "Bakery"],
    // unknown, and mixed-language names
    ["شيء غريب", "Other"],
    ["chicken دجاج", "Meat & fish"],
    ["tomato طماطم", "Produce"],
  ])("%s -> %s", (name, expected) => expect(categorize(name)).toBe(expected));

  it("does not disturb English matching", () => {
    expect(categorize("Olive oil")).toBe("Pantry");
    expect(categorize("bell pepper")).toBe("Produce");
  });
});
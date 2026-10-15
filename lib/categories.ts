export const CATEGORIES = ["Produce", "Meat & fish", "Dairy & eggs", "Bakery", "Pantry", "Frozen", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

// Whole-word match with an optional plural ending.
const words = (alternatives: string) => new RegExp(`\\b(?:${alternatives})(?:e?s)?\\b`);

// Ordered rules, first match wins, so specific compounds come before the words
// they contain ("peanut butter" is pantry although "butter" is dairy). This is a
// heuristic for grouping a list by aisle; anything unmatched lands in "Other".
const RULES: [Category, RegExp][] = [
  ["Frozen", words("ice cream|frozen|popsicle|sorbet")],
  [
    "Pantry",
    new RegExp(
      [
        words(
          [
            "(?:peanut|nut|almond|cashew) butter",
            "(?:coconut|almond|oat|soy|rice) milk",
            "tomato (?:paste|sauce|puree)|passata",
            "stock|broth|bouillon",
            "black pepper|ground pepper|pepper flake|peppercorn",
            "(?:garlic|onion|chili|curry) powder",
            "baking (?:powder|soda)",
            "egg noodle",
            "(?:soy|fish|hot|worcestershire) sauce",
            "(?:olive|vegetable|sesame|canola|coconut) oil",
            "bread ?crumb|panko",
            "canned|tinned",
          ].join("|"),
        ).source,
        "^pepper$", // bare "pepper" in a recipe means the spice; "bell pepper" is produce
      ].join("|"),
    ),
  ],
  ["Dairy & eggs", words("milk|cream|butter|cheese|yogurt|yoghurt|egg|ghee|mozzarella|parmesan|feta|cheddar|ricotta|mascarpone")],
  ["Meat & fish", words("chicken|beef|pork|lamb|turkey|bacon|sausage|ham|steak|mince|salmon|tuna|cod|shrimp|prawn|fish|anchov(?:y|ie)|duck|veal")],
  ["Bakery", words("bread|baguette|bun|roll|bagel|pita|naan|croissant|tortilla|wrap|sourdough")],
  [
    "Produce",
    words(
      "apple|banana|lemon|lime|orange|\\w*berr(?:y|ie)|grape|avocado|tomato|onion|garlic|potato|carrot|celery|lettuce|spinach|kale|cabbage|broccoli|cauliflower|cucumber|zucchini|courgette|pepper|mushroom|leek|ginger|herb|basil|parsley|cilantro|coriander|mint|thyme|rosemary|dill|scallion|shallot|squash|pumpkin|eggplant|aubergine|asparagus|corn|beet|radish|chive|sage|fruit|vegetable|salad|pear|peach|mango|pineapple|melon",
    ),
  ],
  [
    "Pantry",
    words(
      "flour|sugar|salt|rice|pasta|spaghetti|penne|noodle|lentil|bean|chickpea|oat|cereal|honey|syrup|vinegar|oil|cumin|paprika|oregano|cinnamon|turmeric|spice|yeast|cornstarch|ketchup|mustard|mayo|mayonnaise|jam|nut|almond|walnut|cashew|seed|quinoa|couscous|cocoa|chocolate|vanilla|sauce|paste|powder|coconut|raisin|cracker|chip|tofu",
    ),
  ],
];

export function categorize(name: string): Category {
  const n = name.trim().toLowerCase();
  for (const [category, re] of RULES) if (re.test(n)) return category;
  return "Other";
}

import { hasArabic, normalizeArabic } from "./arabic";
import { catalogItemFor } from "./catalog";

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

// \b only knows Latin letters, so Arabic names are matched on normalised whole words or phrases
// (keywords below are written naturally and normalised the same way as the name).
const AR_RULES: [Category, string[]][] = [
  ["Frozen", ["مجمد", "مجمده", "مثلجات", "ايس كريم", "بوظه"]],
  [
    "Pantry",
    [
      "معجون طماطم", "صلصه طماطم", "صلصه", "مرق", "مكعبات مرق", "زيت", "زيت زيتون", "فلفل اسود", "بهارات", "بهار",
      "حليب جوز الهند", "زبده فول سوداني", "فاصولياء بيضاء", "فاصوليا بيضاء", "فاصولياء جافه", "فاصوليا جافه", "معلب", "معلبه",
    ],
  ],
  ["Dairy & eggs", ["حليب", "لبن", "جبن", "جبنه", "زبده", "قشطه", "كريمه", "بيض", "زبادي", "روب", "لبنه", "سمن", "قشده"]],
  [
    "Meat & fish",
    ["دجاج", "فراخ", "لحم", "لحمه", "كفته", "ضان", "بقري", "خروف", "عجل", "سمك", "جمبري", "روبيان", "ديك رومي", "نقانق", "سجق", "كبده", "مفروم", "ستيك", "همبرجر"],
  ],
  ["Bakery", ["خبز", "عيش", "توست", "صمون", "فطير", "كعك", "باجيت"]],
  [
    "Produce",
    [
      "طماطم", "بندوره", "بصل", "ثوم", "بطاطس", "بطاطا", "جزر", "خيار", "ليمون", "بازيلاء", "باميه", "بامياء", "فاصولياء", "فاصوليا",
      "كوسه", "باذنجان", "فلفل", "خس", "سبانخ", "كزبره", "بقدونس", "نعناع", "تفاح", "موز", "برتقال", "ملوخيه", "قرنبيط", "ملفوف", "كرنب",
      "فجل", "بنجر", "ذره", "فطر", "عنب", "فراوله", "مانجو", "بطيخ", "شمام", "كراث", "جرجير", "شبت", "خضار", "فاكهه", "سلطه",
    ],
  ],
  [
    "Pantry",
    [
      "ارز", "عدس", "حمص", "فول", "معكرونه", "مكرونه", "سباغيتي", "شعيريه", "سكر", "ملح", "دقيق", "طحين", "عسل", "خل", "معجون", "كمون",
      "كركم", "قرفه", "برغل", "فريكه", "شاي", "قهوه", "نشا", "خميره", "بقوليات", "لوز", "جوز", "مكسرات", "زبيب", "رب", "تونه", "كاتشب", "مايونيز",
    ],
  ],
];
const AR_RULES_NORMALISED = AR_RULES.map(([cat, kws]) => [cat, kws.map(normalizeArabic)] as const);

function categorizeArabic(name: string): Category | null {
  const padded = ` ${normalizeArabic(name)} `;
  for (const [category, keywords] of AR_RULES_NORMALISED) {
    if (keywords.some((kw) => padded.includes(` ${kw} `))) return category;
  }
  return null;
}

export function categorize(name: string): Category {
  // an ingredient from the ready list always lands in the aisle the list gives it
  const listed = catalogItemFor(name);
  if (listed) return listed.aisle;
  if (hasArabic(name)) {
    const found = categorizeArabic(name);
    if (found) return found;
  }
  const n = name.trim().toLowerCase();
  for (const [category, re] of RULES) if (re.test(n)) return category;
  return "Other";
}

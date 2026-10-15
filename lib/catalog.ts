import { hasArabic, normalizeArabic } from "./arabic";
import type { Category } from "./categories";
import { normalizeName } from "./ingredients";

// A ready list of everyday ingredients to pick from when writing a dish, in Arabic and English, each with the
// shopping-list aisle it belongs to. To add one, add a row below; nothing else needs to change.

export const GROUPS = ["vegetables", "meat", "chicken", "fish", "legumes", "dairy", "oils", "spices"] as const;
export type CatalogGroup = (typeof GROUPS)[number];
/** The usual way an item is measured, as a canonical unit. Only ever a suggestion: quantities are never guessed. */
export type CatalogUnit = "g" | "kg" | "cup" | "piece" | "tbsp" | "tsp" | "ml" | "l";
export type CatalogItem = { group: CatalogGroup; en: string; ar: string; aisle: Category; unit?: CatalogUnit };

const AISLE: Record<CatalogGroup, Category> = {
  vegetables: "Produce",
  meat: "Meat & fish",
  chicken: "Meat & fish",
  fish: "Meat & fish",
  legumes: "Pantry",
  dairy: "Dairy & eggs",
  oils: "Pantry",
  spices: "Pantry",
};

// [English, Arabic, usual unit, aisle when it differs from the group's]
type Row = [en: string, ar: string, unit?: CatalogUnit, aisle?: Category];
const TABLE: Record<CatalogGroup, Row[]> = {
  vegetables: [
    ["tomato", "طماطم"], ["cucumber", "خيار"], ["potato", "بطاطس"], ["sweet potato", "بطاطا"], ["onion", "بصل"],
    ["red onion", "بصل أحمر"], ["green onion", "بصل أخضر"], ["garlic", "ثوم"], ["carrot", "جزر"], ["zucchini", "كوسة"],
    ["eggplant", "باذنجان"], ["okra", "بامية"], ["green peas", "بازلاء"], ["green beans", "فاصولياء خضراء"],
    ["fresh broad beans", "فول أخضر"], ["bell pepper", "فلفل رومي"], ["hot chili pepper", "فلفل حار"], ["spinach", "سبانخ"],
    ["molokhia", "ملوخية"], ["mallow", "خبيزة"], ["swiss chard", "سلق"], ["purslane", "رجلة"], ["cabbage", "كرنب"],
    ["cauliflower", "قرنبيط"], ["broccoli", "بروكلي"], ["lettuce", "خس"], ["arugula", "جرجير"], ["parsley", "بقدونس"],
    ["fresh coriander", "كزبرة خضراء"], ["dill", "شبت"], ["mint", "نعناع"], ["basil", "ريحان"], ["celery", "كرفس"],
    ["leek", "كراث"], ["beetroot", "بنجر"], ["turnip", "لفت"], ["radish", "فجل"], ["pumpkin", "قرع"], ["corn", "ذرة"],
    ["mushroom", "مشروم"], ["artichoke", "خرشوف"], ["fennel", "شمر"], ["taro", "قلقاس"], ["ginger", "زنجبيل"],
    ["lemon", "ليمون"], ["grape leaves", "ورق عنب"], ["asparagus", "هليون"], ["kale", "كيل"],
  ],
  meat: [
    ["minced beef", "لحم بقري مفروم", "g"], ["beef cubes", "لحم بقري مقطع", "g"], ["beef steak", "ستيك بقري", "g"],
    ["beef ribs", "ضلوع بقري", "g"], ["beef liver", "كبدة بقري", "g"], ["beef shank", "موزة بقري", "g"], ["veal", "عجالي", "g"],
    ["lamb leg", "فخذ ضأن", "g"], ["lamb shoulder", "كتف ضأن", "g"], ["lamb ribs", "ريش ضأن", "g"],
    ["lamb chops", "كستليتة ضأن", "g"], ["lamb shank", "موزة ضأن", "g"], ["minced lamb", "ضأن مفروم", "g"],
    ["kofta meat", "لحم كفتة", "g"], ["goat meat", "لحم ماعز", "g"], ["beef tripe", "كرشة", "g"], ["beef tongue", "لسان بقري", "g"],
    ["sausage", "سجق", "g"], ["beef sausages", "نقانق", "g"], ["bacon", "لحم مقدد", "g"], ["rabbit", "أرنب", "g"],
  ],
  chicken: [
    ["whole chicken", "دجاجة كاملة", "piece"], ["chicken breast", "صدور دجاج", "g"], ["chicken fillet", "فيليه دجاج", "g"],
    ["chicken thighs", "أفخاذ دجاج", "g"], ["chicken drumsticks", "وراك دجاج", "g"], ["chicken wings", "أجنحة دجاج", "g"],
    ["chicken leg quarters", "أرجل دجاج", "g"], ["minced chicken", "دجاج مفروم", "g"], ["chicken cubes", "دجاج مقطع", "g"],
    ["chicken liver", "كبدة دجاج", "g"], ["chicken gizzards", "قوانص دجاج", "g"], ["turkey", "ديك رومي", "g"],
    ["duck", "بط", "piece"], ["pigeon", "حمام", "piece"], ["quail", "سمان", "piece"],
  ],
  fish: [
    ["tilapia", "بلطي", "g"], ["sea bass", "قاروص", "g"], ["sea bream", "دنيس", "g"], ["sardines", "سردين", "g"],
    ["mackerel", "ماكريل", "g"], ["salmon", "سلمون", "g"], ["mullet", "بوري", "g"], ["catfish", "قرموط", "g"],
    ["fish fillet", "فيليه سمك", "g"], ["shrimp", "جمبري", "g"], ["calamari", "كاليماري", "g"], ["crab", "سلطعون", "g"],
    ["canned tuna", "تونة معلبة", "piece", "Pantry"],
  ],
  legumes: [
    ["rice", "أرز", "cup"], ["basmati rice", "أرز بسمتي", "cup"], ["vermicelli", "شعرية", "cup"], ["pasta", "مكرونة", "g"],
    ["spaghetti", "سباغيتي", "g"], ["bulgur", "برغل", "cup"], ["freekeh", "فريك", "cup"], ["couscous", "كسكسي", "cup"],
    ["red lentils", "عدس أحمر", "cup"], ["brown lentils", "عدس بني", "cup"], ["yellow lentils", "عدس أصفر", "cup"],
    ["chickpeas", "حمص", "cup"], ["dried fava beans", "فول جاف", "cup"], ["white beans", "فاصولياء بيضاء", "cup"],
    ["kidney beans", "فاصولياء حمراء", "cup"], ["black-eyed peas", "لوبيا", "cup"], ["dried peas", "بسلة جافة", "cup"],
    ["oats", "شوفان", "cup"], ["flour", "دقيق", "cup"], ["semolina", "سميد", "cup"], ["cornstarch", "نشا", "tbsp"],
    ["bread", "عيش", "piece", "Bakery"], ["toast bread", "خبز توست", "piece", "Bakery"],
  ],
  dairy: [
    ["eggs", "بيض", "piece"], ["milk", "حليب", "cup"], ["yoghurt", "زبادي", "cup"], ["cream", "قشطة", "cup"],
    ["butter", "زبدة", "tbsp"], ["ghee", "سمن", "tbsp"], ["white cheese", "جبنة بيضاء", "g"], ["feta cheese", "جبنة فيتا", "g"],
    ["mozzarella", "موزاريلا", "g"], ["cheddar", "شيدر", "g"], ["cream cheese", "جبنة كريمي", "g"], ["labneh", "لبنة", "g"],
    ["buttermilk", "روب", "cup"],
  ],
  oils: [
    ["olive oil", "زيت زيتون", "tbsp"], ["vegetable oil", "زيت نباتي", "tbsp"], ["sunflower oil", "زيت عباد الشمس", "tbsp"],
    ["corn oil", "زيت ذرة", "tbsp"], ["sesame oil", "زيت سمسم", "tbsp"], ["coconut oil", "زيت جوز الهند", "tbsp"],
    ["vegetable shortening", "سمن نباتي", "tbsp"],
  ],
  spices: [
    ["salt", "ملح", "tsp"], ["black pepper", "فلفل أسود", "tsp"], ["white pepper", "فلفل أبيض", "tsp"], ["cumin", "كمون", "tsp"],
    ["ground coriander", "كزبرة مطحونة", "tsp"], ["turmeric", "كركم", "tsp"], ["paprika", "بابريكا", "tsp"],
    ["chili flakes", "فلفل أحمر مجروش", "tsp"], ["cinnamon", "قرفة", "tsp"], ["cardamom", "حبهان", "tsp"], ["cloves", "قرنفل", "tsp"],
    ["nutmeg", "جوزة الطيب", "tsp"], ["bay leaves", "ورق لورا", "piece"], ["mixed spices", "بهارات مشكلة", "tsp"],
    ["seven spices", "سبع بهارات", "tsp"], ["dried mint", "نعناع جاف", "tsp"], ["thyme", "زعتر", "tsp"],
    ["oregano", "أوريجانو", "tsp"], ["sumac", "سماق", "tsp"], ["saffron", "زعفران", "tsp"], ["ginger powder", "زنجبيل مطحون", "tsp"],
    ["garlic powder", "ثوم بودرة", "tsp"], ["stock cube", "مكعب مرقة", "piece"], ["tomato paste", "معجون طماطم", "tbsp"],
    ["tomato sauce", "صلصة طماطم", "cup"], ["vinegar", "خل", "tbsp"], ["lemon juice", "عصير ليمون", "tbsp"],
    ["sugar", "سكر", "tbsp"], ["honey", "عسل", "tbsp"], ["tahini", "طحينة", "tbsp"], ["ketchup", "كاتشب", "tbsp"],
    ["mayonnaise", "مايونيز", "tbsp"], ["baking powder", "بيكنج باودر", "tsp"], ["yeast", "خميرة", "tsp"], ["vanilla", "فانيليا", "tsp"],
  ],
};

export const CATALOG: CatalogItem[] = GROUPS.flatMap((group) =>
  TABLE[group].map(([en, ar, unit, aisle]): CatalogItem => ({ group, en, ar, aisle: aisle ?? AISLE[group], ...(unit ? { unit } : {}) })),
);

/** The way names are compared when looking an ingredient up: Arabic spelling variants and English plurals fold together. */
const key = (name: string) => normalizeName(name);
const BY_KEY = new Map<string, CatalogItem>();
for (const item of CATALOG) for (const n of [item.en, item.ar]) if (!BY_KEY.has(key(n))) BY_KEY.set(key(n), item);

/** The catalog entry an ingredient name refers to (in either language), if it is one. */
export const catalogItemFor = (name: string): CatalogItem | undefined => BY_KEY.get(key(name));

export const catalogName = (item: CatalogItem, lang: "ar" | "en"): string => (lang === "ar" ? item.ar : item.en);

const fold = (s: string) => (hasArabic(s) ? normalizeArabic(s) : s.trim().toLowerCase().replace(/\s+/g, " "));

/**
 * Items whose Arabic or English name contains what was typed, best first: names that start with it, then names with a
 * word that starts with it, then the rest. Spelling variants fold together (ارز finds أرز), and the catalog order breaks ties.
 */
export function searchCatalog(term: string, limit = 40): CatalogItem[] {
  const t = fold(term);
  if (!t) return [];
  const rank = (item: CatalogItem): number => {
    let best = 3;
    for (const name of [fold(item.en), fold(item.ar)]) {
      if (name.startsWith(t)) best = Math.min(best, 0);
      else if (name.split(" ").some((w) => w.startsWith(t))) best = Math.min(best, 1);
      else if (name.includes(t)) best = Math.min(best, 2);
    }
    return best;
  };
  return CATALOG.map((item, i) => ({ item, i, r: rank(item) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.item);
}

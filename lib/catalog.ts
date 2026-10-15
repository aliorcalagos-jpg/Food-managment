import { hasArabic, normalizeArabic } from "./arabic";
import type { Category } from "./categories";
import { normalizeName } from "./ingredients";

// A ready list of everyday ingredients to pick from when writing a dish, in Arabic and English, each with the
// shopping-list aisle it belongs to and a little picture. To add one, add a row below; nothing else needs to change.

export const GROUPS = ["vegetables", "meat", "chicken", "fish", "legumes", "dairy", "oils", "spices"] as const;
export type CatalogGroup = (typeof GROUPS)[number];
/** The usual way an item is measured, as a canonical unit. Only ever a suggestion: quantities are never guessed. */
export type CatalogUnit = "g" | "kg" | "cup" | "piece" | "tbsp" | "tsp" | "ml" | "l";
/** How an item is drawn: one of a set of simple shapes, in the item's own colours (see artifact/src/ui/FoodIcon.tsx). */
export const SHAPES = [
  // vegetables
  "round", "bulb", "carrot", "long", "eggplant", "leaf", "sprig", "head", "floret", "pod", "bell", "chili", "mushroom", "root",
  "corn", "pumpkin", "lemon", "artichoke", "stalks", "jar",
  // meat, chicken, fish
  "steak", "ribs", "chop", "cubes", "mince", "shank", "roast", "organ", "sausage", "tongue", "bacon", "oxtail", "bone", "bird",
  "drumstick", "wing", "fillet", "fish", "shrimp", "rings", "crab", "can",
  // everything else
  "egg", "bottle", "carton", "cup", "wedge", "block", "heap", "beans", "sack", "loaf", "pasta", "cube",
] as const;
export type Shape = (typeof SHAPES)[number];
export type Look = { shape: Shape; color: string; accent?: string };
export type CatalogItem = { group: CatalogGroup; en: string; ar: string; aisle: Category; look: Look; unit?: CatalogUnit };

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

const L = (shape: Shape, color: string, accent?: string): Look => ({ shape, color, ...(accent ? { accent } : {}) });

// [English, Arabic, picture, usual unit, aisle when it differs from the group's]
type Row = [en: string, ar: string, look: Look, unit?: CatalogUnit, aisle?: Category];
const TABLE: Record<CatalogGroup, Row[]> = {
  vegetables: [
    // fruits and roots
    ["tomato", "طماطم", L("round", "#e5483b", "#4c9a3a")], ["cherry tomato", "طماطم كرزية", L("round", "#d8352a", "#4c9a3a")],
    ["cucumber", "خيار", L("long", "#4f9d3a")], ["zucchini", "كوسة", L("long", "#6fae48", "#c8e6a0")],
    ["eggplant", "باذنجان", L("eggplant", "#5b2a86", "#5a9e3a")], ["white eggplant", "باذنجان أبيض", L("eggplant", "#efe9d4", "#7cb342")],
    ["okra", "بامية", L("pod", "#6aa84f", "#b7dd8a")], ["green peas", "بازلاء", L("pod", "#7bc043", "#d7f0b0")],
    ["beans", "فاصولياء", L("pod", "#5aa23a", "#b7dd8a")], ["green beans", "فاصولياء خضراء", L("pod", "#4f9a2e", "#a9d680")], ["fresh broad beans", "فول أخضر", L("pod", "#8bc34a", "#e3f2c1")],
    ["bell pepper", "فلفل رومي", L("bell", "#e53935", "#43a047")], ["green bell pepper", "فلفل رومي أخضر", L("bell", "#43a047", "#2e7d32")],
    ["yellow bell pepper", "فلفل رومي أصفر", L("bell", "#fdd835", "#43a047")], ["hot chili pepper", "فلفل حار", L("chili", "#d32f2f", "#43a047")],
    ["green chili pepper", "فلفل أخضر حار", L("chili", "#4caf50", "#2e7d32")], ["banana pepper", "فلفل بلدي", L("chili", "#9ccc65", "#558b2f")],
    ["corn", "ذرة", L("corn", "#f5c518", "#5a9e3a")], ["pumpkin", "قرع", L("pumpkin", "#f08a24", "#5a9e3a")],
    ["butternut squash", "قرع عسلي", L("pumpkin", "#e2b06a", "#8d6e3b")], ["lemon", "ليمون", L("lemon", "#f6d743", "#7cb342")],
    ["lime", "ليمون أخضر", L("lemon", "#8bc34a", "#558b2f")], ["artichoke", "خرشوف", L("artichoke", "#6b8e4e", "#4c6b34")],
    ["olives", "زيتون", L("round", "#5b6b2f", "#8a9a4e"), undefined, "Pantry"],
    ["orange bell pepper", "فلفل رومي برتقالي", L("bell", "#fb8c00", "#43a047")], ["green tomato", "طماطم خضراء", L("round", "#8bc34a", "#4c9a3a")],
    ["green squash", "قرع أخضر", L("long", "#9ccc65", "#dcedc8")], ["snow peas", "بسلة سكرية", L("pod", "#9ccc65", "#e3f2c1")],
    // bulbs and roots
    ["onion", "بصل", L("bulb", "#e3b878", "#8a6d3b")], ["red onion", "بصل أحمر", L("bulb", "#9b3f78", "#6b2a54")],
    ["shallot", "شالوت", L("bulb", "#c98b5e", "#8a5a38")], ["garlic", "ثوم", L("bulb", "#efe8d6", "#b7a98a")],
    ["fennel", "شمر", L("bulb", "#dce9c5", "#7cb342")], ["potato", "بطاطس", L("root", "#cfa56a", "#8a6a3b")],
    ["sweet potato", "بطاطا", L("root", "#c2552d", "#7a2f14")], ["taro", "قلقاس", L("root", "#9b7b6a", "#6a4a3a")],
    ["ginger", "زنجبيل", L("root", "#d9b77a", "#a8803d")], ["fresh turmeric", "كركم طازج", L("root", "#e89b20", "#a8660a")],
    ["carrot", "جزر", L("carrot", "#f08a24", "#43a047")], ["beetroot", "بنجر", L("round", "#8e2b57", "#43a047")],
    ["radish", "فجل", L("round", "#d6336c", "#43a047")], ["turnip", "لفت", L("round", "#d9c3e6", "#7cb342")],
    ["jerusalem artichoke", "أرضي شوكي", L("root", "#d9bb8a", "#a8803d")], ["celeriac", "كرفس أبو جذر", L("root", "#cdb98d", "#8a7a52")],
    ["parsnip", "جزر أبيض", L("carrot", "#f1e6c4", "#8bc34a")], ["cassava", "كسافا", L("root", "#b8946a", "#6a4a3a")],
    ["kohlrabi", "كرنب أبو ركبة", L("round", "#9ccc65", "#558b2f")], ["white radish", "فجل أبيض", L("long", "#f1efe4", "#7cb342")],
    // leaves, herbs and heads
    ["spinach", "سبانخ", L("leaf", "#2e7d32")], ["molokhia", "ملوخية", L("leaf", "#388e3c")], ["mallow", "خبيزة", L("leaf", "#66bb6a")],
    ["swiss chard", "سلق", L("leaf", "#2e7d32", "#d32f2f")], ["purslane", "رجلة", L("leaf", "#7cb342")], ["romaine lettuce", "خس روماني", L("leaf", "#7cb342")],
    ["arugula", "جرجير", L("leaf", "#558b2f")], ["kale", "كيل", L("leaf", "#2f6b3a")], ["dandelion greens", "هندباء", L("leaf", "#6a994e")],
    ["grape leaves", "ورق عنب", L("leaf", "#4e8f3a")], ["lettuce", "خس", L("head", "#9ccc65", "#689f38")],
    ["cabbage", "كرنب", L("head", "#a5d6a7", "#66a36a")], ["red cabbage", "كرنب أحمر", L("head", "#8e3b8a", "#5e2459")],
    ["brussels sprouts", "كرنب بروكسل", L("head", "#7cb342", "#4c7a24")], ["cauliflower", "قرنبيط", L("floret", "#f1eddc", "#8bc34a")],
    ["broccoli", "بروكلي", L("floret", "#388e3c", "#66a36a")], ["parsley", "بقدونس", L("sprig", "#2e7d32")],
    ["coriander", "كزبرة", L("sprig", "#43a047")], ["fresh coriander", "كزبرة خضراء", L("sprig", "#43a047")], ["dill", "شبت", L("sprig", "#7cb342")], ["mint", "نعناع", L("sprig", "#26a269")],
    ["basil", "ريحان", L("sprig", "#2e7d32")], ["fresh thyme", "زعتر أخضر", L("sprig", "#5b8c5a")], ["rosemary", "روزماري", L("sprig", "#4d7c4d")],
    ["sage", "مريمية", L("sprig", "#8ba888")], ["fenugreek leaves", "حلبة خضراء", L("sprig", "#4caf50")], ["chives", "ثوم معمر", L("sprig", "#3f8f4a")],
    ["green onion", "بصل أخضر", L("stalks", "#5aa83c", "#f4f1e6")], ["green garlic", "ثوم أخضر", L("stalks", "#7cb342", "#f4f1e6")],
    ["leek", "كراث", L("stalks", "#8bc34a", "#f4f1e6")], ["celery", "كرفس", L("stalks", "#9ccc65", "#c5e1a5")],
    ["asparagus", "هليون", L("stalks", "#6aa84f", "#a5d68a")], ["mushroom", "مشروم", L("mushroom", "#e8dccb", "#f7f1e6")],
    ["oyster mushroom", "مشروم محاري", L("mushroom", "#bfb5a5", "#d9d1c4")],
    // frozen and pickled
    ["frozen peas", "بازلاء مجمدة", L("pod", "#7bc043", "#d7f0b0"), undefined, "Frozen"], ["frozen okra", "بامية مجمدة", L("pod", "#6aa84f", "#b7dd8a"), undefined, "Frozen"],
    ["frozen mixed vegetables", "خضار مشكل مجمد", L("heap", "#8bc34a", "#e0e0e0"), undefined, "Frozen"],
    ["pickled cucumbers", "مخلل خيار", L("jar", "#7cb342", "#cfd8dc"), undefined, "Pantry"], ["pickled turnips", "مخلل لفت", L("jar", "#d6336c", "#cfd8dc"), undefined, "Pantry"],
    ["pickled lemons", "ليمون مخلل", L("jar", "#f6d743", "#cfd8dc"), undefined, "Pantry"],
  ],
  meat: [
    // beef and veal
    ["meat", "لحم", L("roast", "#b7312c", "#e8d6b0"), "g"], ["minced beef", "لحم بقري مفروم", L("mince", "#b7312c"), "g"], ["beef cubes", "لحم بقري مقطع", L("cubes", "#b7312c"), "g"],
    ["beef steak", "ستيك بقري", L("steak", "#b7312c", "#f3e6d2"), "g"], ["beef sirloin", "سيرلوين بقري", L("steak", "#a52a27", "#f3e6d2"), "g"],
    ["beef ribeye", "ريب آي بقري", L("steak", "#c23b33", "#f7efe0"), "g"], ["beef tenderloin", "فيليه بقري", L("fillet", "#c0392b"), "g"],
    ["beef ribs", "ضلوع بقري", L("ribs", "#b7312c", "#f4ecd8"), "g"], ["beef brisket", "صدر بقري", L("roast", "#9c2f2a", "#e8d6b0"), "g"],
    ["beef chuck", "رقبة بقري", L("roast", "#b7312c", "#e8d6b0"), "g"], ["beef shank", "موزة بقري", L("shank", "#b7312c", "#f4ecd8"), "g"],
    ["beef oxtail", "ذيل بقري", L("oxtail", "#a52a27", "#f4ecd8"), "g"], ["beef bones", "عظام بقري", L("bone", "#f4ecd8"), "g"],
    ["beef liver", "كبدة بقري", L("organ", "#7a2f2f"), "g"], ["beef kidney", "كلاوي بقري", L("organ", "#8a3a3a"), "g"],
    ["beef heart", "قلب بقري", L("organ", "#8f2f35"), "g"], ["beef tripe", "كرشة", L("organ", "#e8dcc4", "#cdbf9f"), "g"],
    ["beef tongue", "لسان بقري", L("tongue", "#c98a7a"), "g"], ["beef trotters", "كوارع بقري", L("shank", "#d9b99a", "#f4ecd8"), "g"],
    ["beef burger patties", "برجر لحم", L("mince", "#9c2f2a"), "g"], ["pastrami", "بسطرمة", L("steak", "#8a2d2a", "#f3d7b0"), "g"],
    ["veal", "عجالي", L("steak", "#e29a8f", "#f7ece0"), "g"], ["veal escalope", "اسكالوب عجالي", L("fillet", "#ecaa9f"), "g"],
    // lamb, goat and others
    ["lamb leg", "فخذ ضأن", L("roast", "#c4584d", "#f4ecd8"), "g"], ["lamb shoulder", "كتف ضأن", L("roast", "#c9645a", "#f4ecd8"), "g"],
    ["lamb ribs", "ريش ضأن", L("ribs", "#c4584d", "#f4ecd8"), "g"], ["lamb rack", "راك ضأن", L("ribs", "#d06a5e", "#f4ecd8"), "g"],
    ["lamb chops", "كستليتة ضأن", L("chop", "#c4584d", "#f4ecd8"), "g"], ["lamb shank", "موزة ضأن", L("shank", "#c4584d", "#f4ecd8"), "g"],
    ["lamb neck", "رقبة ضأن", L("roast", "#bb4f45", "#e8d6b0"), "g"], ["lamb breast", "صدر ضأن", L("ribs", "#c9645a", "#f4ecd8"), "g"],
    ["minced lamb", "ضأن مفروم", L("mince", "#c4584d"), "g"], ["lamb cubes", "ضأن مقطع", L("cubes", "#c4584d"), "g"],
    ["lamb liver", "كبدة ضأن", L("organ", "#8a3a3a"), "g"], ["lamb kidney", "كلاوي ضأن", L("organ", "#9a4646"), "g"],
    ["lamb tail fat", "ألية ضأن", L("cubes", "#f6efe2", "#e6d9bd"), "g"], ["lamb trotters", "كوارع ضأن", L("shank", "#d9b99a", "#f4ecd8"), "g"],
    ["kofta meat", "لحم كفتة", L("mince", "#a8352f"), "g"], ["kebab meat", "لحم كباب", L("cubes", "#a8352f"), "g"],
    ["goat meat", "لحم ماعز", L("roast", "#b8473d", "#f4ecd8"), "g"], ["camel meat", "لحم جمل", L("steak", "#a33b32", "#f3e6d2"), "g"],
    ["rabbit", "أرنب", L("roast", "#d9948a", "#f4ecd8"), "g"], ["sausage", "سجق", L("sausage", "#b5532a"), "g"],
    ["beef sausages", "نقانق", L("sausage", "#c0603a"), "g"], ["bacon", "لحم مقدد", L("bacon", "#c8594e", "#f6e3d8"), "g"],
  ],
  chicken: [
    ["chicken", "دجاج", L("bird", "#f0b872", "#f7dcae"), "g"], ["whole chicken", "دجاجة كاملة", L("bird", "#f0b872", "#f7dcae"), "piece"], ["chicken breast", "صدور دجاج", L("fillet", "#f4d3b0"), "g"],
    ["chicken fillet", "فيليه دجاج", L("fillet", "#f6dcc0"), "g"], ["chicken strips", "شرائح دجاج", L("fillet", "#f0c9a0"), "g"],
    ["chicken thighs", "أفخاذ دجاج", L("drumstick", "#e9a766", "#f4ecd8"), "g"], ["boneless chicken thighs", "أفخاذ دجاج بدون عظم", L("fillet", "#e9b283"), "g"],
    ["chicken drumsticks", "وراك دجاج", L("drumstick", "#ebb26f", "#f4ecd8"), "g"], ["chicken wings", "أجنحة دجاج", L("wing", "#eba96a", "#f4ecd8"), "g"],
    ["chicken leg quarters", "أرجل دجاج", L("drumstick", "#e8a25f", "#f4ecd8"), "g"], ["minced chicken", "دجاج مفروم", L("mince", "#f1c7a0"), "g"],
    ["chicken cubes", "دجاج مقطع", L("cubes", "#f3cfa6"), "g"], ["chicken liver", "كبدة دجاج", L("organ", "#8a3b2e"), "g"],
    ["chicken gizzards", "قوانص دجاج", L("organ", "#9a5a4a"), "g"], ["chicken hearts", "قلوب دجاج", L("organ", "#a2483c"), "g"],
    ["chicken neck", "رقبة دجاج", L("bone", "#f0c9a0"), "g"], ["chicken carcass", "هيكل دجاج", L("ribs", "#f0d3b0", "#f4ecd8"), "g"],
    ["chicken feet", "كوارع دجاج", L("wing", "#e9c28e", "#f4ecd8"), "g"], ["chicken sausages", "نقانق دجاج", L("sausage", "#e8a766"), "g"],
    ["turkey", "ديك رومي", L("bird", "#e8b075", "#f4d8b0"), "g"], ["turkey breast", "صدور ديك رومي", L("fillet", "#f0cfaa"), "g"],
    ["turkey legs", "أفخاذ ديك رومي", L("drumstick", "#d9985a", "#f4ecd8"), "g"],
    ["duck", "بط", L("bird", "#d89556", "#f2d3a4"), "piece"], ["pigeon", "حمام", L("bird", "#d9a46a", "#f2d3a4"), "piece"], ["quail", "سمان", L("bird", "#e0ad72", "#f2d3a4"), "piece"],
  ],
  fish: [
    ["fish", "سمك", L("fish", "#9fb4bd", "#e0e8ec"), "g"], ["tilapia", "بلطي", L("fish", "#9fb4bd", "#e0e8ec"), "g"], ["sea bass", "قاروص", L("fish", "#a7b8c4", "#e0e8ec"), "g"], ["sea bream", "دنيس", L("fish", "#d8a7a7", "#f3dede"), "g"],
    ["sardines", "سردين", L("fish", "#aab7c4", "#e0e8ec"), "g"], ["mackerel", "ماكريل", L("fish", "#6f8ea3", "#cfe0ea"), "g"], ["salmon", "سلمون", L("fillet", "#f08c6d"), "g"],
    ["mullet", "بوري", L("fish", "#b5b9a8", "#e3e6d8"), "g"], ["catfish", "قرموط", L("fish", "#6b6f63", "#c9ccc0"), "g"], ["fish fillet", "فيليه سمك", L("fillet", "#f3e0d2"), "g"],
    ["shrimp", "جمبري", L("shrimp", "#f08a6a", "#f6b9a2"), "g"], ["calamari", "كاليماري", L("rings", "#efe3d6"), "g"], ["crab", "سلطعون", L("crab", "#d9533a", "#f08a6a"), "g"],
    ["canned tuna", "تونة معلبة", L("can", "#c9d1d6", "#1e6fb5"), "piece", "Pantry"],
  ],
  legumes: [
    ["rice", "أرز", L("heap", "#f4f1e6", "#d9d3c0"), "cup"], ["basmati rice", "أرز بسمتي", L("heap", "#f0ead0", "#d9d3c0"), "cup"],
    ["vermicelli", "شعرية", L("pasta", "#f1dfa8"), "cup"], ["pasta", "مكرونة", L("pasta", "#f2d98a"), "g"], ["spaghetti", "سباغيتي", L("pasta", "#f0d27a"), "g"],
    ["bulgur", "برغل", L("heap", "#c08a4a", "#e6c28e"), "cup"], ["freekeh", "فريك", L("heap", "#8a8a4a", "#c3c38a"), "cup"], ["couscous", "كسكسي", L("heap", "#f0d9a0", "#e0c47a"), "cup"],
    ["red lentils", "عدس أحمر", L("beans", "#d9552b", "#f08a60"), "cup"], ["brown lentils", "عدس بني", L("beans", "#8a6a3b", "#b8935a"), "cup"], ["yellow lentils", "عدس أصفر", L("beans", "#e8b923", "#f5d86a"), "cup"],
    ["chickpeas", "حمص", L("beans", "#d9b36a", "#ecd29c"), "cup"], ["dried fava beans", "فول جاف", L("beans", "#7a5c3a", "#a8865a"), "cup"], ["white beans", "فاصولياء بيضاء", L("beans", "#f1ecdc", "#fff9e8"), "cup"],
    ["kidney beans", "فاصولياء حمراء", L("beans", "#9b2d2d", "#c25a5a"), "cup"], ["black-eyed peas", "لوبيا", L("beans", "#efe6d0", "#222222"), "cup"], ["dried peas", "بسلة جافة", L("beans", "#7ca33b", "#a9c870"), "cup"],
    ["oats", "شوفان", L("heap", "#e6d7b3", "#cdbd96"), "cup"], ["flour", "دقيق", L("sack", "#f3f1ea", "#c9c4b0"), "cup"], ["semolina", "سميد", L("sack", "#f0dca0", "#c9b36a"), "cup"],
    ["cornstarch", "نشا", L("sack", "#fafafa", "#c9c4b0"), "tbsp"], ["bread", "عيش", L("loaf", "#d9a860", "#f0d49a"), "piece", "Bakery"], ["toast bread", "خبز توست", L("loaf", "#e3bb7a", "#f4dba8"), "piece", "Bakery"],
  ],
  dairy: [
    ["eggs", "بيض", L("egg", "#f1d9b5"), "piece"], ["milk", "حليب", L("carton", "#e8f1f8", "#2f7fc1"), "cup"], ["yoghurt", "زبادي", L("cup", "#f7f7f7", "#3a9ad9"), "cup"],
    ["cream", "قشطة", L("cup", "#fbf4e2", "#d9a441"), "cup"], ["butter", "زبدة", L("block", "#f6dc7a", "#e8c14e"), "tbsp"], ["ghee", "سمن", L("jar", "#e8c14e", "#cfd8dc"), "tbsp"],
    ["white cheese", "جبنة بيضاء", L("wedge", "#f5efe0", "#d9cfae"), "g"], ["feta cheese", "جبنة فيتا", L("wedge", "#f2f2ea", "#cfcfc0"), "g"], ["mozzarella", "موزاريلا", L("wedge", "#f7f3e6", "#e0d9c0"), "g"],
    ["cheddar", "شيدر", L("wedge", "#f0a830", "#d98a10"), "g"], ["cream cheese", "جبنة كريمي", L("cup", "#fff8ea", "#8ab4d9"), "g"], ["labneh", "لبنة", L("cup", "#fffaf0", "#7cb342"), "g"],
    ["buttermilk", "روب", L("carton", "#f4f6f8", "#7cb342"), "cup"],
  ],
  oils: [
    ["oil", "زيت", L("bottle", "#f2c230", "#d9a010"), "tbsp"], ["olive oil", "زيت زيتون", L("bottle", "#8a9a2e", "#3f5a1a"), "tbsp"], ["vegetable oil", "زيت نباتي", L("bottle", "#f2c230", "#d9a010"), "tbsp"],
    ["sunflower oil", "زيت عباد الشمس", L("bottle", "#f0b800", "#2f7d32"), "tbsp"], ["corn oil", "زيت ذرة", L("bottle", "#e8c040", "#f5c518"), "tbsp"],
    ["sesame oil", "زيت سمسم", L("bottle", "#b8782a", "#7a4a12"), "tbsp"], ["coconut oil", "زيت جوز الهند", L("jar", "#f4f1ea", "#cfd8dc"), "tbsp"],
    ["vegetable shortening", "سمن نباتي", L("jar", "#f5eec0", "#d9a441"), "tbsp"],
  ],
  spices: [
    ["salt", "ملح", L("jar", "#f2f2f2", "#90a4ae"), "tsp"], ["black pepper", "فلفل أسود", L("jar", "#3a3a3a", "#90a4ae"), "tsp"], ["white pepper", "فلفل أبيض", L("jar", "#e8e2d4", "#90a4ae"), "tsp"],
    ["cumin", "كمون", L("heap", "#8b6a35", "#b89455"), "tsp"], ["ground coriander", "كزبرة مطحونة", L("heap", "#b79a52", "#d9c284"), "tsp"], ["turmeric", "كركم", L("heap", "#e8a317", "#f5c95a"), "tsp"],
    ["paprika", "بابريكا", L("heap", "#c9372c", "#e0685f"), "tsp"], ["chili flakes", "فلفل أحمر مجروش", L("heap", "#b3261e", "#e0685f"), "tsp"], ["cinnamon", "قرفة", L("heap", "#9a5b2f", "#c08855"), "tsp"],
    ["cardamom", "حبهان", L("heap", "#9cb36a", "#c9d9a0"), "tsp"], ["cloves", "قرنفل", L("heap", "#5a3a26", "#8a6048"), "tsp"], ["nutmeg", "جوزة الطيب", L("heap", "#8a6a4a", "#b8946a"), "tsp"],
    ["bay leaves", "ورق لورا", L("sprig", "#6b8e4e"), "piece"], ["mixed spices", "بهارات مشكلة", L("heap", "#a8743a", "#d19a5e"), "tsp"], ["seven spices", "سبع بهارات", L("heap", "#8a5a2b", "#b8854e"), "tsp"],
    ["dried mint", "نعناع جاف", L("heap", "#6b8f5a", "#98b886"), "tsp"], ["thyme", "زعتر", L("heap", "#6a7a4a", "#98a874"), "tsp"], ["oregano", "أوريجانو", L("heap", "#6a8a4a", "#98b874"), "tsp"],
    ["sumac", "سماق", L("heap", "#8c2b3a", "#b8606e"), "tsp"], ["saffron", "زعفران", L("heap", "#e8780a", "#f5a04a"), "tsp"], ["ginger powder", "زنجبيل مطحون", L("heap", "#d4a94a", "#ecd08a"), "tsp"],
    ["garlic powder", "ثوم بودرة", L("heap", "#efe0b8", "#d9c88a"), "tsp"], ["stock cube", "مكعب مرقة", L("cube", "#c9a24a", "#e8c97a"), "piece"], ["tomato paste", "معجون طماطم", L("jar", "#c62828", "#cfd8dc"), "tbsp"],
    ["tomato sauce", "صلصة طماطم", L("bottle", "#d32f2f", "#7a1a1a"), "cup"], ["vinegar", "خل", L("bottle", "#c9b26b", "#8a7a3a"), "tbsp"], ["lemon juice", "عصير ليمون", L("bottle", "#f2d84a", "#7cb342"), "tbsp"],
    ["sugar", "سكر", L("sack", "#f7f7f2", "#c9c4b0"), "tbsp"], ["honey", "عسل", L("jar", "#e8a317", "#cfd8dc"), "tbsp"], ["tahini", "طحينة", L("jar", "#d9b985", "#cfd8dc"), "tbsp"],
    ["ketchup", "كاتشب", L("bottle", "#d32f2f", "#7a1a1a"), "tbsp"], ["mayonnaise", "مايونيز", L("jar", "#f5efd5", "#cfd8dc"), "tbsp"], ["baking powder", "بيكنج باودر", L("jar", "#e6e6e6", "#e53935"), "tsp"],
    ["yeast", "خميرة", L("jar", "#c9a26b", "#e8c97a"), "tsp"], ["vanilla", "فانيليا", L("bottle", "#5a3a22", "#2a1a0e"), "tsp"],
  ],
};

export const CATALOG: CatalogItem[] = GROUPS.flatMap((group) =>
  TABLE[group].map(([en, ar, look, unit, aisle]): CatalogItem => ({ group, en, ar, aisle: aisle ?? AISLE[group], look, ...(unit ? { unit } : {}) })),
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

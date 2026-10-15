import { createContext, useContext } from "react";
import { formatQuantity } from "../../lib/quantity";

export type Lang = "en" | "ar";
export const DEFAULT_LANG: Lang = "ar";
export const dirFor = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");

// English is the source of truth: the Arabic table below must have exactly the same keys.
// Counts use "label: number" wording in Arabic (الحصص: 4) so no plural form can be wrong.
const en = {
  brand: "Meal Planner",
  sections: "Sections",
  tabRecipes: "Recipes",
  tabPlanner: "Planner",
  tabLists: "Lists",
  language: "Language",
  switchTo: "العربية",
  loading: "Loading your kitchen…",
  unavailableTitle: "Your recipes can't be opened right now",
  unavailableBody: "This page keeps everything in your claude.ai account, so open it from claude.ai while signed in as its owner.",
  saveFailed: "Couldn't save that: {msg}",
  dismiss: "Dismiss",

  // recipes
  recipesH: "Recipes",
  newRecipe: "New recipe",
  editRecipe: "Edit recipe",
  examplesNote: "These are example recipes to show how the planner works.",
  removeExamples: "Remove examples",
  removeExamplesConfirm: "Remove all examples",
  searchLabel: "Search recipes",
  searchPlaceholder: "Search by title or ingredient",
  filterTags: "Filter by tag",
  noRecipes: "No recipes yet",
  noRecipesHint: "Add the first one, then plan your week around it.",
  noMatch: "No recipes match",
  clearFilters: "Clear filters",
  rowMeta: "{servings} servings · {count} ingredients",
  rowMetaOne: "{servings} servings · 1 ingredient",
  rowMetaNoIng: "{servings} servings · No ingredients yet",
  backToRecipes: "All recipes",
  backToRecipesPlain: "Back to recipes",
  edit: "Edit",
  delete: "Delete",
  deleteRecipeConfirm: "Delete recipe and its planned meals",
  servingsMeta: "{servings} servings",
  source: "Source",
  ingredientsH: "Ingredients",
  instructionsH: "Instructions",
  noIngredientsYet: "No ingredients yet",
  addIngredientsCta: "Add ingredients",
  recipeGone: "That recipe isn't here any more",

  // recipe form
  fTitle: "Title",
  fServings: "Servings",
  fTags: "Tags (comma separated)",
  fTagsPh: "dinner, quick",
  fQty: "Quantity {n}",
  fUnit: "Unit {n}",
  fIng: "Ingredient {n}",
  fRemoveIng: "Remove ingredient {n}",
  phQty: "1/2",
  phUnit: "unit",
  phIng: "flour",
  addIngredient: "+ Add ingredient",
  fInstructions: "Instructions",
  fSource: "Source link (optional)",
  saveRecipe: "Save recipe",
  saving: "Saving…",
  cancel: "Cancel",

  // validation and generation messages (see forms.ts and model.ts)
  errTitleRequired: "Title is required",
  errTitleLong: "At most 120 characters",
  errServingsInt: "Servings must be a whole number",
  errServingsRange: "Use 1 to 100",
  errTagsMany: "At most 10 tags",
  errUrl: "Enter a valid http(s) link",
  errQty: 'Check the quantity for "{name}" (e.g. 2, 0.5 or 1/2)',
  errQtyRow: "Check the quantity in row {n} (e.g. 2, 0.5 or 1/2)",
  errRowName: "Row {n} needs an ingredient name",
  errIngMany: "At most 100 ingredients",
  errPickDates: "Pick a start and end date.",
  errEndBefore: "The end date must be on or after the start date.",
  errRangeLong: "Pick at most {max} days.",
  errNoMeals: "No meals are planned between those dates. Add some in the planner first.",
  errOnlyEmptyDishes: "The planned dishes have no ingredients yet: {names}. Add ingredients to them first.",
  noteSkipped: "Not on the list because they have no ingredients yet: {names}",

  // planner
  plannerH: "Weekly plan",
  weekNav: "Week",
  prev: "Previous",
  next: "Next",
  thisWeek: "This week",
  needRecipe: "You need a recipe before you can plan meals",
  needRecipeHint: "Add one in the Recipes tab.",
  today: "Today",
  addRecipe: "Add a recipe",
  pickRecipe: "Recipe for {meal} on {day}",
  servingsOptional: "Servings (optional)",
  phServings: "servings",
  add: "Add",
  servingsFor: "Servings for {title}",
  servingsWord: "servings",
  remove: "Remove",
  removeFrom: "Remove {title} from {meal} on {day}",
  deletedRecipe: "Deleted recipe",
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",

  // lists
  listsH: "Shopping lists",
  newListFromPlan: "New list from your meal plan",
  from: "From",
  to: "To",
  listName: "Name (optional)",
  phListName: "e.g. Saturday shop",
  generate: "Generate from meal plan",
  defaultListName: "Meals {range}",
  blankLabel: "New empty list name",
  phBlank: "Or start an empty list",
  create: "Create",
  noLists: "No lists yet",
  noListsHint: "Plan some meals, then generate one above.",
  progress: "{done} of {total} done",
  backToLists: "All lists",
  backToListsPlain: "Back to lists",
  deleteList: "Delete list",
  deleteListConfirm: "Delete this list",
  itemQty: "Quantity",
  itemUnit: "Unit",
  itemName: "Item name",
  phItemName: "Add an item",
  errItemName: "Enter an item name.",
  errItemQty: "Use a number like 2, 0.5 or 1/2.",
  listEmpty: "This list is empty",
  listEmptyHint: "Add your first item above.",
  listGone: "That list isn't here any more",
  removeItem: "Remove {name}",
  clearChecked1: "Clear 1 checked item",
  clearCheckedN: "Clear {n} checked items",
  clearCheckedConfirm: "Remove checked items",

  // aisles (stored data keeps the English key)
  "aisle:Produce": "Produce",
  "aisle:Meat & fish": "Meat & fish",
  "aisle:Dairy & eggs": "Dairy & eggs",
  "aisle:Bakery": "Bakery",
  "aisle:Pantry": "Pantry",
  "aisle:Frozen": "Frozen",
  "aisle:Other": "Other",

  // units (stored data keeps the canonical unit)
  "unit:g": "g",
  "unit:kg": "kg",
  "unit:ml": "ml",
  "unit:l": "l",
  "unit:tsp": "tsp",
  "unit:tbsp": "tbsp",
  "unit:cup": "cup",
  "unit:oz": "oz",
  "unit:lb": "lb",
} as const;

export type MsgKey = keyof typeof en;

const ar: Record<MsgKey, string> = {
  brand: "مخطط الوجبات",
  sections: "الأقسام",
  tabRecipes: "الوصفات",
  tabPlanner: "الخطة",
  tabLists: "القوائم",
  language: "اللغة",
  switchTo: "English",
  loading: "جارٍ تحميل مطبخك…",
  unavailableTitle: "تعذّر فتح وصفاتك الآن",
  unavailableBody: "تُحفظ جميع البيانات في حسابك على claude.ai، لذا افتح هذه الصفحة من claude.ai وأنت مسجّل الدخول بصفتك مالكها.",
  saveFailed: "تعذّر الحفظ: {msg}",
  dismiss: "إغلاق",

  recipesH: "الوصفات",
  newRecipe: "وصفة جديدة",
  editRecipe: "تعديل الوصفة",
  examplesNote: "هذه وصفات تجريبية لتوضيح طريقة عمل المخطط.",
  removeExamples: "حذف الأمثلة",
  removeExamplesConfirm: "حذف كل الأمثلة",
  searchLabel: "ابحث في الوصفات",
  searchPlaceholder: "ابحث بالاسم أو المكوّن",
  filterTags: "تصفية حسب الوسم",
  noRecipes: "لا توجد وصفات بعد",
  noRecipesHint: "أضف أول وصفة ثم خطّط أسبوعك بها.",
  noMatch: "لا توجد وصفات مطابقة",
  clearFilters: "مسح التصفية",
  rowMeta: "الحصص: {servings} · المكوّنات: {count}",
  rowMetaOne: "الحصص: {servings} · المكوّنات: 1",
  rowMetaNoIng: "الحصص: {servings} · لا مكوّنات بعد",
  backToRecipes: "كل الوصفات",
  backToRecipesPlain: "العودة إلى الوصفات",
  edit: "تعديل",
  delete: "حذف",
  deleteRecipeConfirm: "حذف الوصفة ووجباتها المخطط لها",
  servingsMeta: "الحصص: {servings}",
  source: "المصدر",
  ingredientsH: "المكوّنات",
  instructionsH: "طريقة التحضير",
  noIngredientsYet: "لا توجد مكوّنات بعد",
  addIngredientsCta: "أضف المكوّنات",
  recipeGone: "هذه الوصفة لم تعد موجودة",

  fTitle: "الاسم",
  fServings: "عدد الحصص",
  fTags: "الوسوم (مفصولة بفاصلة)",
  fTagsPh: "عشاء، سريع",
  fQty: "الكمية {n}",
  fUnit: "الوحدة {n}",
  fIng: "المكوّن {n}",
  fRemoveIng: "حذف المكوّن {n}",
  phQty: "1/2",
  phUnit: "الوحدة",
  phIng: "دقيق",
  addIngredient: "+ إضافة مكوّن",
  fInstructions: "طريقة التحضير",
  fSource: "رابط المصدر (اختياري)",
  saveRecipe: "حفظ الوصفة",
  saving: "جارٍ الحفظ…",
  cancel: "إلغاء",

  errTitleRequired: "الاسم مطلوب",
  errTitleLong: "120 حرفًا كحد أقصى",
  errServingsInt: "يجب أن يكون عدد الحصص رقمًا صحيحًا",
  errServingsRange: "استخدم رقمًا من 1 إلى 100",
  errTagsMany: "10 وسوم كحد أقصى",
  errUrl: "أدخل رابطًا صحيحًا يبدأ بـ http أو https",
  errQty: "تحقّق من كمية «{name}» (مثل 2 أو 0.5 أو 1/2)",
  errQtyRow: "تحقّق من الكمية في الصف {n} (مثل 2 أو 0.5 أو 1/2)",
  errRowName: "الصف {n} يحتاج إلى اسم مكوّن",
  errIngMany: "100 مكوّن كحد أقصى",
  errPickDates: "اختر تاريخ البداية والنهاية.",
  errEndBefore: "يجب ألا يسبق تاريخ النهاية تاريخ البداية.",
  errRangeLong: "اختر {max} يومًا كحد أقصى.",
  errNoMeals: "لا توجد وجبات مخططة بين هذين التاريخين. أضف بعضها في المخطط أولًا.",
  errOnlyEmptyDishes: "الأطباق المخططة ليس لها مكوّنات بعد: {names}. أضف المكوّنات أولًا.",
  noteSkipped: "لم تُضف إلى القائمة لأنها بلا مكوّنات بعد: {names}",

  plannerH: "خطة الأسبوع",
  weekNav: "الأسبوع",
  prev: "السابق",
  next: "التالي",
  thisWeek: "هذا الأسبوع",
  needRecipe: "تحتاج إلى وصفة قبل تخطيط الوجبات",
  needRecipeHint: "أضف واحدة من تبويب الوصفات.",
  today: "اليوم",
  addRecipe: "إضافة وصفة",
  pickRecipe: "وصفة {meal} يوم {day}",
  servingsOptional: "عدد الحصص (اختياري)",
  phServings: "الحصص",
  add: "إضافة",
  servingsFor: "حصص {title}",
  servingsWord: "حصص",
  remove: "إزالة",
  removeFrom: "إزالة {title} من {meal} يوم {day}",
  deletedRecipe: "وصفة محذوفة",
  BREAKFAST: "الفطور",
  LUNCH: "الغداء",
  DINNER: "العشاء",
  SNACK: "وجبة خفيفة",

  listsH: "قوائم التسوق",
  newListFromPlan: "قائمة جديدة من خطة وجباتك",
  from: "من",
  to: "إلى",
  listName: "الاسم (اختياري)",
  phListName: "مثال: تسوق السبت",
  generate: "إنشاء من خطة الوجبات",
  defaultListName: "وجبات {range}",
  blankLabel: "اسم القائمة الفارغة الجديدة",
  phBlank: "أو ابدأ قائمة فارغة",
  create: "إنشاء",
  noLists: "لا توجد قوائم بعد",
  noListsHint: "خطّط بعض الوجبات ثم أنشئ قائمة من الأعلى.",
  progress: "تم: {done} من {total}",
  backToLists: "كل القوائم",
  backToListsPlain: "العودة إلى القوائم",
  deleteList: "حذف القائمة",
  deleteListConfirm: "حذف هذه القائمة",
  itemQty: "الكمية",
  itemUnit: "الوحدة",
  itemName: "اسم العنصر",
  phItemName: "أضف عنصرًا",
  errItemName: "أدخل اسم العنصر.",
  errItemQty: "استخدم رقمًا مثل 2 أو 0.5 أو 1/2.",
  listEmpty: "هذه القائمة فارغة",
  listEmptyHint: "أضف أول عنصر من الأعلى.",
  listGone: "هذه القائمة لم تعد موجودة",
  removeItem: "إزالة {name}",
  clearChecked1: "مسح العناصر المحددة (1)",
  clearCheckedN: "مسح العناصر المحددة ({n})",
  clearCheckedConfirm: "إزالة العناصر المحددة",

  "aisle:Produce": "الخضار والفاكهة",
  "aisle:Meat & fish": "اللحوم والأسماك",
  "aisle:Dairy & eggs": "الألبان والبيض",
  "aisle:Bakery": "المخبوزات",
  "aisle:Pantry": "المؤن",
  "aisle:Frozen": "المجمدات",
  "aisle:Other": "أخرى",

  "unit:g": "جم",
  "unit:kg": "كيلو",
  "unit:ml": "مل",
  "unit:l": "لتر",
  "unit:tsp": "ملعقة صغيرة",
  "unit:tbsp": "ملعقة كبيرة",
  "unit:cup": "كوب",
  "unit:oz": "أونصة",
  "unit:lb": "رطل",
};

export const TABLES: Record<Lang, Record<MsgKey, string>> = { en, ar };

export type Params = Record<string, string | number>;

/** An error or notice as data: the UI translates it, so logic and tests stay language-free. */
export type Msg = { key: MsgKey; params?: Params };

export function translate(lang: Lang, key: MsgKey, params?: Params): string {
  const text = TABLES[lang][key] ?? TABLES.en[key];
  return params ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`)) : text;
}

const UNIT_KEYS = new Set(["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb"]);

/** Stored units are canonical English (kg, cup). Show the Arabic word in Arabic; anything else as typed. */
export function unitLabel(lang: Lang, unit: string): string {
  return UNIT_KEYS.has(unit) ? translate(lang, `unit:${unit}` as MsgKey) : unit;
}

/** Stored aisle keys are English. Unknown ones show as stored. */
export function aisleLabel(lang: Lang, category: string): string {
  const key = `aisle:${category}` as MsgKey;
  return key in en ? translate(lang, key) : category;
}

export const unitSuggestions = (lang: Lang): string[] =>
  [...UNIT_KEYS].map((u) => unitLabel(lang, u));

/** "1 1/2 cup flour" / "1 1/2 كوب دقيق", with quantity digits always 0-9. */
export function itemText(lang: Lang, quantity: number, unit: string, name: string): string {
  return [formatQuantity(quantity), unitLabel(lang, unit), name].filter(Boolean).join(" ");
}

type I18n = { lang: Lang; dir: "ltr" | "rtl"; t: (key: MsgKey, params?: Params) => string };

export const I18nContext = createContext<I18n>({ lang: DEFAULT_LANG, dir: dirFor(DEFAULT_LANG), t: (k, p) => translate(DEFAULT_LANG, k, p) });
export const useI18n = () => useContext(I18nContext);

export function makeI18n(lang: Lang): I18n {
  return { lang, dir: dirFor(lang), t: (key, params) => translate(lang, key, params) };
}

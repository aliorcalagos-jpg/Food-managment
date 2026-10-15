export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
};

type UnitFamily = "mass" | "volume" | "count";

// Factors convert to the base unit of each family: grams, millilitres, pieces.
// Related units are derived from each other so conversions are exact
// (16 tbsp is precisely 1 cup, 16 oz precisely 1 lb).
const TSP_ML = 4.92892159375; // US teaspoon
const LB_G = 453.59237;

const UNITS: Record<string, { family: UnitFamily; factor: number }> = {
  g: { family: "mass", factor: 1 },
  kg: { family: "mass", factor: 1000 },
  oz: { family: "mass", factor: LB_G / 16 },
  lb: { family: "mass", factor: LB_G },
  ml: { family: "volume", factor: 1 },
  l: { family: "volume", factor: 1000 },
  tsp: { family: "volume", factor: TSP_ML },
  tbsp: { family: "volume", factor: TSP_ML * 3 },
  cup: { family: "volume", factor: TSP_ML * 48 },
  "": { family: "count", factor: 1 },
};

const ALIASES: Record<string, string> = {
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  ounce: "oz",
  ounces: "oz",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  milliliter: "ml",
  milliliters: "ml",
  liter: "l",
  liters: "l",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cups: "cup",
  piece: "",
  pieces: "",
  pc: "",
  pcs: "",
};

export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  return u in ALIASES ? ALIASES[u] : u;
}

export function normalizeName(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  // naive singularisation so "tomatoes" and "tomato" merge
  if (n.endsWith("oes")) return n.slice(0, -2);
  if (n.endsWith("ies")) return n.slice(0, -3) + "y";
  if (n.endsWith("s") && !n.endsWith("ss")) return n.slice(0, -1);
  return n;
}

/** Scale a recipe ingredient from the recipe's servings to the planned servings. */
export function scaleIngredient(
  ing: Ingredient,
  recipeServings: number,
  plannedServings: number,
): Ingredient {
  if (recipeServings <= 0) throw new Error("recipeServings must be > 0");
  return { ...ing, quantity: (ing.quantity * plannedServings) / recipeServings };
}

// Scrubs float noise (0.1 + 0.2) without destroying fractions like 1/3 that
// formatQuantity wants to recognise.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

type Bucket = {
  name: string; // first-seen spelling, used for display (never the singularised key)
  family: string;
  base: number; // total in the family's base unit
  units: Map<string, number>; // total per unit as written
};

const displayName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Merge ingredients by name, summing quantities across compatible units.
 * - Names are matched loosely ("egg" = "Eggs") but shown as first written.
 * - If every entry uses the same unit, that unit is kept as is (3 cups stays
 *   3 cup, not 710 ml). Mixed units convert to the largest unit present in
 *   which the total is at least 1 (2 cup + 4 tbsp -> 2.25 cup).
 * - Incompatible families for one name (grams vs tablespoons) stay separate
 *   lines, and unknown units ("bunch", "can") only merge with themselves.
 */
export function mergeIngredients(items: Ingredient[]): Ingredient[] {
  const buckets = new Map<string, Bucket>();

  for (const item of items) {
    const unit = normalizeUnit(item.unit);
    const def = UNITS[unit];
    const family = def ? def.family : `custom:${unit}`;
    const key = `${normalizeName(item.name)}|${family}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { name: displayName(item.name), family, base: 0, units: new Map() }));
    b.base += item.quantity * (def?.factor ?? 1);
    b.units.set(unit, (b.units.get(unit) ?? 0) + item.quantity);
  }

  return [...buckets.values()]
    .map((b): Ingredient => {
      if (b.family === "count" || b.family.startsWith("custom:")) {
        const [unit] = b.units.keys();
        return { name: b.name, quantity: round(b.base), unit };
      }
      if (b.units.size === 1) {
        const [[unit, qty]] = b.units;
        return { name: b.name, quantity: round(qty), unit };
      }
      const present = [...b.units.keys()].sort((x, y) => UNITS[y].factor - UNITS[x].factor);
      const unit = present.find((u) => b.base / UNITS[u].factor >= 1) ?? present[present.length - 1];
      return { name: b.name, quantity: round(b.base / UNITS[unit].factor), unit };
    })
    .sort((a, c) => a.name.localeCompare(c.name));
}

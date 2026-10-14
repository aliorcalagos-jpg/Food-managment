export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
};

type UnitFamily = "mass" | "volume" | "count";

// Factors convert to the base unit of each family: grams, millilitres, pieces.
const UNITS: Record<string, { family: UnitFamily; factor: number }> = {
  g: { family: "mass", factor: 1 },
  kg: { family: "mass", factor: 1000 },
  oz: { family: "mass", factor: 28.3495 },
  lb: { family: "mass", factor: 453.592 },
  ml: { family: "volume", factor: 1 },
  l: { family: "volume", factor: 1000 },
  tsp: { family: "volume", factor: 4.92892 },
  tbsp: { family: "volume", factor: 14.7868 },
  cup: { family: "volume", factor: 236.588 },
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

function pickDisplayUnit(family: UnitFamily, base: number, original: string) {
  if (family === "mass") return base >= 1000 ? { unit: "kg", qty: base / 1000 } : { unit: "g", qty: base };
  if (family === "volume") return base >= 1000 ? { unit: "l", qty: base / 1000 } : { unit: "ml", qty: base };
  return { unit: original, qty: base };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Merge ingredients by name, summing quantities across compatible units.
 * Incompatible unit families for the same name stay as separate lines.
 */
export function mergeIngredients(items: Ingredient[]): Ingredient[] {
  const buckets = new Map<string, { name: string; family: UnitFamily | string; base: number; unit: string }>();

  for (const item of items) {
    const unit = normalizeUnit(item.unit);
    const def = UNITS[unit];
    const name = normalizeName(item.name);
    // Unknown units (e.g. "bunch", "can") only merge with the same unit.
    const family = def ? def.family : `custom:${unit}`;
    const key = `${name}|${family}`;
    const base = item.quantity * (def?.factor ?? 1);
    const existing = buckets.get(key);
    if (existing) existing.base += base;
    else buckets.set(key, { name, family, base, unit });
  }

  return [...buckets.values()]
    .map(({ name, family, base, unit }) => {
      if (family === "mass" || family === "volume" || family === "count") {
        const { unit: u, qty } = pickDisplayUnit(family, base, unit);
        return { name, quantity: round(qty), unit: u };
      }
      return { name, quantity: round(base), unit };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

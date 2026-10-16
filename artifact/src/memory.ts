// What the person's own dishes say about how they cook: the amount they used last time for each ingredient, and which
// ingredients they use most. Worked out from the saved dishes (nothing extra is stored), so it is never out of date.
import { normalizeName } from "../../lib/ingredients";
import { formatQuantity, parseQuantity } from "../../lib/quantity";
import type { Recipe } from "./model";

export type Amount = { quantity: string; unit: string };
export type Memory = {
  /** The latest amount per ingredient (by matching name, so أرز / رز / الأرز share one). */
  last: Map<string, Amount>;
  /** Ingredient names, most used first (the first spelling written is kept), at most `limit`. */
  often: string[];
};

type Row = { name: string; quantity: string; unit: string };

export const memoryKey = (name: string) => normalizeName(name);

const NO_MEMORY: Memory = { last: new Map(), often: [] };
export const emptyMemory = (): Memory => NO_MEMORY;

function collect(rowsByDish: Row[][], limit: number): Memory {
  const last = new Map<string, Amount>();
  const counts = new Map<string, { name: string; count: number; first: number }>();
  let order = 0;
  for (const rows of rowsByDish) {
    const seenInDish = new Set<string>();
    for (const r of rows) {
      const name = r.name.trim();
      if (!name) continue;
      const k = memoryKey(name);
      if (parseQuantity(r.quantity) !== null) last.set(k, { quantity: r.quantity, unit: r.unit });
      if (seenInDish.has(k)) continue; // one count per dish
      seenInDish.add(k);
      const c = counts.get(k);
      if (c) c.count++;
      else counts.set(k, { name, count: 1, first: order++ });
    }
  }
  const often = [...counts.values()].sort((a, b) => b.count - a.count || a.first - b.first).slice(0, limit).map((c) => c.name);
  return { last, often };
}

/** From the saved dishes (in the order they are stored; a later dish's amount wins). */
export function buildMemory(recipes: Recipe[], limit = 12): Memory {
  return collect(
    recipes.map((r) => r.ingredients.map((i) => ({ name: i.name, quantity: formatQuantity(i.quantity), unit: i.unit }))),
    limit,
  );
}

/** The same, plus the ingredients already entered in the dish being edited (they count as the newest). */
export function withRows(base: Memory, rows: Row[], limit = 12): Memory {
  const last = new Map(base.last);
  const often = [...base.often];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    const k = memoryKey(name);
    if (parseQuantity(r.quantity) !== null) last.set(k, { quantity: r.quantity, unit: r.unit });
    if (!often.some((o) => memoryKey(o) === k) && often.length < limit) often.push(name);
  }
  return { last, often };
}

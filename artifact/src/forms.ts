import { toLatinDigits } from "../../lib/arabic";
import { parseQuantity } from "../../lib/quantity";
import { parseTags } from "../../lib/tags";
import { isHttpUrl } from "../../lib/url";
import type { Msg } from "./i18n";
import type { Recipe } from "./model";

export type RecipeFormValues = {
  title: string;
  servings: string;
  tags: string;
  sourceUrl: string;
  instructions: string;
  rows: { name: string; quantity: string; unit: string }[];
};

export type RecipeErrors = Partial<Record<"title" | "servings" | "tags" | "sourceUrl" | "ingredients", Msg>>;

/**
 * Validate the recipe form. Blank ingredient rows are ignored, and a dish may be saved with no
 * ingredients at all (name first, ingredients later); a half-filled row is still an error.
 * Errors are message keys, translated where they are shown.
 */
export function validateRecipe(v: RecipeFormValues): { ok: true; recipe: Omit<Recipe, "id"> } | { ok: false; errors: RecipeErrors } {
  const errors: RecipeErrors = {};

  const title = v.title.trim();
  if (!title) errors.title = { key: "errTitleRequired" };
  else if (title.length > 120) errors.title = { key: "errTitleLong" };

  const servings = Number(toLatinDigits(v.servings).trim() || NaN);
  if (!Number.isInteger(servings)) errors.servings = { key: "errServingsInt" };
  else if (servings < 1 || servings > 100) errors.servings = { key: "errServingsRange" };

  const tags = parseTags(v.tags);
  if (tags.length > 10) errors.tags = { key: "errTagsMany" };

  const sourceUrl = v.sourceUrl.trim();
  if (sourceUrl && (sourceUrl.length > 2000 || !isHttpUrl(sourceUrl))) errors.sourceUrl = { key: "errUrl" };

  const ingredients: Recipe["ingredients"] = [];
  for (const [i, row] of v.rows.entries()) {
    const name = row.name.trim();
    if (!name && !row.quantity.trim() && !row.unit.trim()) continue;
    const quantity = parseQuantity(row.quantity);
    if (quantity === null || quantity > 100000) {
      errors.ingredients ??= name ? { key: "errQty", params: { name } } : { key: "errQtyRow", params: { n: i + 1 } };
    } else if (!name) {
      errors.ingredients ??= { key: "errRowName", params: { n: i + 1 } };
    } else {
      ingredients.push({ name, quantity, unit: row.unit.trim() });
    }
  }
  if (!errors.ingredients && ingredients.length > 100) errors.ingredients = { key: "errIngMany" };

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    recipe: { title, servings, tags, instructions: v.instructions.trim(), sourceUrl: sourceUrl || null, ingredients },
  };
}

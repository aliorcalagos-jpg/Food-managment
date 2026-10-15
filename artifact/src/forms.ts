import { parseQuantity } from "../../lib/quantity";
import { parseTags } from "../../lib/tags";
import { isHttpUrl } from "../../lib/url";
import type { Recipe } from "./model";

export type RecipeFormValues = {
  title: string;
  servings: string;
  tags: string;
  sourceUrl: string;
  instructions: string;
  rows: { name: string; quantity: string; unit: string }[];
};

export type RecipeErrors = Partial<Record<"title" | "servings" | "tags" | "sourceUrl" | "ingredients", string>>;

/** Validate the recipe form the same way the Next app does; blank ingredient rows are ignored. */
export function validateRecipe(v: RecipeFormValues): { ok: true; recipe: Omit<Recipe, "id"> } | { ok: false; errors: RecipeErrors } {
  const errors: RecipeErrors = {};

  const title = v.title.trim();
  if (!title) errors.title = "Title is required";
  else if (title.length > 120) errors.title = "At most 120 characters";

  const servings = Number(v.servings);
  if (!Number.isInteger(servings)) errors.servings = "Servings must be a whole number";
  else if (servings < 1 || servings > 100) errors.servings = "Use 1 to 100";

  const tags = parseTags(v.tags);
  if (tags.length > 10) errors.tags = "At most 10 tags";

  const sourceUrl = v.sourceUrl.trim();
  if (sourceUrl && (sourceUrl.length > 2000 || !isHttpUrl(sourceUrl))) errors.sourceUrl = "Enter a valid http(s) link";

  const ingredients: Recipe["ingredients"] = [];
  for (const [i, row] of v.rows.entries()) {
    const name = row.name.trim();
    if (!name && !row.quantity.trim() && !row.unit.trim()) continue;
    const quantity = parseQuantity(row.quantity);
    if (quantity === null || quantity > 100000) {
      errors.ingredients ??= `Check the quantity for "${name || `row ${i + 1}`}" (e.g. 2, 0.5 or 1/2)`;
    } else if (!name) {
      errors.ingredients ??= `Row ${i + 1} needs an ingredient name`;
    } else {
      ingredients.push({ name, quantity, unit: row.unit.trim() });
    }
  }
  if (!errors.ingredients && ingredients.length === 0) errors.ingredients = "Add at least one ingredient";
  if (ingredients.length > 100) errors.ingredients = "At most 100 ingredients";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    recipe: { title, servings, tags, instructions: v.instructions.trim(), sourceUrl: sourceUrl || null, ingredients },
  };
}

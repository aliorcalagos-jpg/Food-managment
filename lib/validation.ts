import { z } from "zod";
import { MEAL_TYPES } from "./meals";
import { parseQuantity } from "./quantity";
import { daysBetween, parseISODate } from "./week";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(72),
});

export const householdNameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

export const inviteCodeSchema = z.object({
  code: z.string().trim().min(1, "Enter an invite code").max(64),
});

/** Flatten zod issues to { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const { protocol } = new URL(v);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid http(s) link");

export const ingredientInputSchema = z.object({
  name: z.string().trim().min(1, "Ingredient name is required").max(120),
  quantity: z.number().positive().max(100000),
  unit: z.string().trim().max(30),
});

export const recipeSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  servings: z.number().int("Servings must be a whole number").min(1, "At least 1").max(100),
  instructions: z.string().trim().max(20000),
  sourceUrl: httpUrl.nullable(),
  tags: z.array(z.string()).max(10, "At most 10 tags"),
  ingredients: z.array(ingredientInputSchema).min(1, "Add at least one ingredient").max(100),
});

export type RecipeInput = z.infer<typeof recipeSchema>;

export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);
    if (t) seen.add(t);
  }
  return [...seen];
}

/** Turn the recipe form's raw FormData into validated input (or field errors). */
export function parseRecipeForm(formData: FormData):
  | { ok: true; data: RecipeInput }
  | { ok: false; errors: Record<string, string> } {
  const names = formData.getAll("ing_name").map(String);
  const qtys = formData.getAll("ing_qty").map(String);
  const units = formData.getAll("ing_unit").map(String);

  const errors: Record<string, string> = {};
  const ingredients: { name: string; quantity: number; unit: string }[] = [];
  names.forEach((name, i) => {
    const qtyRaw = qtys[i] ?? "";
    // fully blank rows are ignored
    if (!name.trim() && !qtyRaw.trim() && !(units[i] ?? "").trim()) return;
    const quantity = parseQuantity(qtyRaw);
    if (quantity === null) {
      errors.ingredients ??= `Check the quantity for "${name.trim() || `row ${i + 1}`}" (e.g. 2, 0.5 or 1/2)`;
      return;
    }
    ingredients.push({ name, quantity, unit: units[i] ?? "" });
  });

  const servings = Number(formData.get("servings"));
  const sourceRaw = String(formData.get("sourceUrl") ?? "").trim();
  const parsed = recipeSchema.safeParse({
    title: formData.get("title") ?? "",
    servings: Number.isFinite(servings) ? servings : 0,
    instructions: formData.get("instructions") ?? "",
    sourceUrl: sourceRaw === "" ? null : sourceRaw,
    tags: parseTags(String(formData.get("tags") ?? "")),
    ingredients,
  });
  if (!parsed.success) {
    const fe = fieldErrors(parsed.error);
    // zod reports ingredient problems under "ingredients"; keep a quantity error if we already have one
    return { ok: false, errors: { ...fe, ...errors } };
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: parsed.data };
}

const isoDate = z.string().refine((v) => parseISODate(v) !== null, "Invalid date");

const optionalServings = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : Number(v)))
  .pipe(z.number().int("Servings must be a whole number").min(1).max(100).optional());

export const addMealSchema = z.object({
  date: isoDate,
  mealType: z.enum(MEAL_TYPES),
  recipeId: z.string().min(1).max(64),
  servings: optionalServings,
});

export const updateMealSchema = z.object({
  entryId: z.string().min(1).max(64),
  servings: z.coerce.number().int("Servings must be a whole number").min(1).max(100),
});

export const MAX_LIST_RANGE_DAYS = 62;

export const generateListSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(80)
      .transform((v) => (v === "" ? undefined : v)),
    start: isoDate,
    end: isoDate,
  })
  .superRefine((v, ctx) => {
    const start = parseISODate(v.start);
    const end = parseISODate(v.end);
    if (!start || !end) return;
    if (end < start) ctx.addIssue({ code: "custom", path: ["end"], message: "End date must be on or after the start date" });
    else if (daysBetween(start, end) + 1 > MAX_LIST_RANGE_DAYS)
      ctx.addIssue({ code: "custom", path: ["end"], message: `Pick at most ${MAX_LIST_RANGE_DAYS} days` });
  });

export const blankListSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(80) });

export const addItemSchema = z.object({
  listId: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Item name is required").max(120),
  quantity: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return 1;
      const q = parseQuantity(v);
      if (q === null || q > 100000) {
        ctx.addIssue({ code: "custom", message: "Use a number like 2, 0.5 or 1/2" });
        return z.NEVER;
      }
      return q;
    }),
  unit: z.string().trim().max(30),
});

export const toggleItemSchema = z.object({
  itemId: z.string().min(1).max(64),
  checked: z.enum(["true", "false"]).transform((v) => v === "true"),
});

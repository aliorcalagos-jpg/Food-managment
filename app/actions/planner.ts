"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/dal";
import { addMeal, removeMeal, updateMealServings } from "@/lib/plan-service";
import { addMealSchema, updateMealSchema } from "@/lib/validation";
import { parseISODate } from "@/lib/week";

// Used as <form action>, so these return nothing. The UI constrains every field,
// so invalid input only arrives from a forged request and is simply ignored.

export async function addMealAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold();
  const parsed = addMealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { date, ...rest } = parsed.data;
  await addMeal(householdId, { ...rest, date: parseISODate(date)! });
  revalidatePath("/planner");
}

export async function updateMealAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold();
  const parsed = updateMealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await updateMealServings(householdId, parsed.data.entryId, parsed.data.servings);
  revalidatePath("/planner");
}

export async function removeMealAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold();
  const entryId = String(formData.get("entryId") ?? "");
  if (entryId) await removeMeal(householdId, entryId);
  revalidatePath("/planner");
}

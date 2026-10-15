"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireHousehold } from "@/lib/dal";
import { createRecipe, deleteRecipe, updateRecipe } from "@/lib/recipe-service";
import { parseRecipeForm } from "@/lib/validation";
import type { FormState } from "./types";

export async function createRecipeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { householdId } = await requireHousehold();
  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const { id } = await createRecipe(householdId, parsed.data);
  revalidatePath("/recipes");
  redirect(`/recipes/${id}`);
}

export async function updateRecipeAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { householdId } = await requireHousehold();
  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  if (!(await updateRecipe(householdId, id, parsed.data))) notFound();
  revalidatePath("/recipes");
  redirect(`/recipes/${id}`);
}

export async function deleteRecipeAction(id: string): Promise<void> {
  const { householdId } = await requireHousehold();
  await deleteRecipe(householdId, id);
  revalidatePath("/recipes");
  redirect("/recipes");
}

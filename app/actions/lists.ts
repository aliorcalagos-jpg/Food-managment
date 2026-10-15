"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/dal";
import { addItem, clearChecked, createBlankList, deleteList, generateList, removeItem, setItemChecked } from "@/lib/list-service";
import { addItemSchema, blankListSchema, fieldErrors, generateListSchema, toggleItemSchema } from "@/lib/validation";
import { formatRange, parseISODate } from "@/lib/week";
import type { FormState } from "./types";

const refresh = () => revalidatePath("/lists", "layout");

export async function generateListAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { householdId } = await requireHousehold();
  const parsed = generateListSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const start = parseISODate(parsed.data.start)!;
  const end = parseISODate(parsed.data.end)!;
  const list = await generateList(householdId, { name: parsed.data.name ?? `Meals ${formatRange(start, end)}`, start, end });
  if (!list) return { errors: { form: "No meals are planned between those dates. Add some in the planner first." } };

  refresh();
  redirect(`/lists/${list.id}`);
}

export async function createBlankListAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { householdId } = await requireHousehold();
  const parsed = blankListSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { id } = await createBlankList(householdId, parsed.data.name);
  refresh();
  redirect(`/lists/${id}`);
}

export async function addItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { householdId } = await requireHousehold();
  const parsed = addItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { listId, ...item } = parsed.data;
  if (!(await addItem(householdId, listId, item))) return { errors: { form: "That list no longer exists" } };
  refresh();
  return { message: "added" };
}

// The three below are used directly as <form action>, so they return nothing.
// The UI only sends valid values; anything else is a forged request and is ignored.

export async function toggleItemAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold();
  const parsed = toggleItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setItemChecked(householdId, parsed.data.itemId, parsed.data.checked);
  refresh();
}

export async function removeItemAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold();
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId) await removeItem(householdId, itemId);
  refresh();
}

export async function clearCheckedAction(listId: string): Promise<void> {
  const { householdId } = await requireHousehold();
  await clearChecked(householdId, listId);
  refresh();
}

export async function deleteListAction(listId: string): Promise<void> {
  const { householdId } = await requireHousehold();
  await deleteList(householdId, listId);
  refresh();
  redirect("/lists");
}

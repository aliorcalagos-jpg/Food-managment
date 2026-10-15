"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold, verifySession } from "@/lib/dal";
import {
  AlreadyInHouseholdError,
  createHousehold,
  ForbiddenError,
  InvalidInviteError,
  joinHousehold,
  regenerateInviteCode,
} from "@/lib/household-service";
import { fieldErrors, householdNameSchema, inviteCodeSchema } from "@/lib/validation";
import type { FormState } from "./types";

export async function createHouseholdAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const parsed = householdNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { name: String(formData.get("name") ?? "") } };

  try {
    await createHousehold(userId, parsed.data.name);
  } catch (e) {
    if (e instanceof AlreadyInHouseholdError) redirect("/");
    throw e;
  }
  redirect("/");
}

export async function joinHouseholdAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const parsed = inviteCodeSchema.safeParse(Object.fromEntries(formData));
  const values = { code: String(formData.get("code") ?? "") };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  try {
    await joinHousehold(userId, parsed.data.code);
  } catch (e) {
    if (e instanceof InvalidInviteError) return { errors: { code: "That invite code isn't valid" }, values };
    if (e instanceof AlreadyInHouseholdError) redirect("/");
    throw e;
  }
  redirect("/");
}

export async function regenerateInviteAction(): Promise<void> {
  const ctx = await requireHousehold();
  try {
    await regenerateInviteCode(ctx.userId, ctx.householdId);
  } catch (e) {
    if (e instanceof ForbiddenError) return;
    throw e;
  }
  revalidatePath("/household");
}

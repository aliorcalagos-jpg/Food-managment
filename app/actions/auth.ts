"use server";

import { redirect } from "next/navigation";
import { authenticate, EmailTakenError, registerUser } from "@/lib/auth-service";
import { createSession, deleteSession } from "@/lib/session";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation";
import type { FormState } from "./types";

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  let userId: string;
  try {
    userId = (await registerUser(parsed.data)).id;
  } catch (e) {
    if (e instanceof EmailTakenError) return { errors: { email: "An account with this email already exists" }, values };
    throw e;
  }
  await createSession(userId);
  redirect("/onboarding");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  // Same message for malformed input, unknown email and wrong password.
  const invalid = { message: "Invalid email or password", values: { email: String(formData.get("email") ?? "") } };
  if (!parsed.success) return invalid;

  const userId = await authenticate(parsed.data.email, parsed.data.password);
  if (!userId) return invalid;

  await createSession(userId);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

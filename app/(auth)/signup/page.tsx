"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/form-field";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <form action={action} className="space-y-4">
        <Field label="Name" name="name" autoComplete="name" error={state?.errors?.name} defaultValue={state?.values?.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" error={state?.errors?.email} defaultValue={state?.values?.email} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" error={state?.errors?.password} />
        {state?.message && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
        <SubmitButton pending={pending}>Sign up</SubmitButton>
      </form>
      <p className="text-sm">
        Already have an account? <Link className="underline" href="/login">Log in</Link>
      </p>
    </>
  );
}

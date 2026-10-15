"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/form-field";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <form action={action} className="space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        {state?.message && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
        <SubmitButton pending={pending}>Log in</SubmitButton>
      </form>
      <p className="text-sm">
        New here? <Link className="underline" href="/signup">Create an account</Link>
      </p>
    </>
  );
}

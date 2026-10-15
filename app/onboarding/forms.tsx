"use client";

import { useActionState } from "react";
import { createHouseholdAction, joinHouseholdAction } from "@/app/actions/household";
import { Field, SubmitButton } from "@/components/form-field";

export function CreateHouseholdForm() {
  const [state, action, pending] = useActionState(createHouseholdAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Household name" name="name" error={state?.errors?.name} defaultValue={state?.values?.name} />
      <SubmitButton pending={pending}>Create household</SubmitButton>
    </form>
  );
}

export function JoinHouseholdForm() {
  const [state, action, pending] = useActionState(joinHouseholdAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Invite code" name="code" error={state?.errors?.code} defaultValue={state?.values?.code} />
      <SubmitButton pending={pending}>Join household</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState, useOptimistic, useState } from "react";
import { addItemAction, createBlankListAction, generateListAction, toggleItemAction } from "@/app/actions/lists";
import type { FormState } from "@/app/actions/types";
import { SubmitButton } from "./form-field";

const input =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function GenerateListForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [state, action, pending] = useActionState(generateListAction, undefined);
  // controlled so a failed submit doesn't wipe what was typed
  const [v, setV] = useState({ name: "", start: defaultStart, end: defaultEnd });
  const err = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">
            From
            <input type="date" name="start" required value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} aria-invalid={err.start ? true : undefined} aria-describedby={err.start ? "start-error" : undefined} className={input} />
          </label>
          {err.start && <p id="start-error" className="mt-1 text-sm text-red-600">{err.start}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">
            To
            <input type="date" name="end" required value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} aria-invalid={err.end ? true : undefined} aria-describedby={err.end ? "end-error" : undefined} className={input} />
          </label>
          {err.end && <p id="end-error" className="mt-1 text-sm text-red-600">{err.end}</p>}
        </div>
      </div>
      <label className="block text-sm font-medium">
        Name (optional)
        <input name="name" maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Saturday shop" className={input} />
      </label>
      {err.form && <p role="alert" className="text-sm text-red-600">{err.form}</p>}
      <SubmitButton pending={pending}>Generate from meal plan</SubmitButton>
    </form>
  );
}

export function BlankListForm() {
  const [state, action, pending] = useActionState(createBlankListAction, undefined);
  const [name, setName] = useState("");
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <label className="block flex-1 text-sm font-medium">
        <span className="sr-only">New empty list name</span>
        <input name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Or start an empty list" className={input.replace("mt-1 ", "")} />
        {state?.errors?.name && <span className="mt-1 block text-sm text-red-600">{state.errors.name}</span>}
      </label>
      <button disabled={pending} className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Create</button>
    </form>
  );
}

export function AddItemForm({ listId }: { listId: string }) {
  const [v, setV] = useState({ quantity: "", unit: "", name: "" });
  const submit = async (prev: FormState, fd: FormData) => {
    const result = await addItemAction(prev, fd);
    if (!result?.errors) setV({ quantity: "", unit: "", name: "" });
    return result;
  };
  const [state, action, pending] = useActionState(submit, undefined);
  const small = input.replace("mt-1 ", "");
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="listId" value={listId} />
      <div className="grid grid-cols-[4.5rem_5rem_1fr_auto] items-center gap-2">
        <input name="quantity" aria-label="Quantity" inputMode="decimal" placeholder="1" value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} className={small} />
        <input name="unit" aria-label="Unit" placeholder="unit" value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} className={small} />
        <input name="name" aria-label="Item name" required placeholder="Add an item" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={small} />
        <button disabled={pending} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white">Add</button>
      </div>
      {(state?.errors?.quantity || state?.errors?.name || state?.errors?.form) && (
        <p role="alert" className="text-sm text-red-600">{state.errors.quantity ?? state.errors.name ?? state.errors.form}</p>
      )}
    </form>
  );
}

/** Checkbox that flips immediately and saves in the background. */
export function ItemCheckbox({ itemId, checked, label }: { itemId: string; checked: boolean; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  return (
    <form
      action={async (fd: FormData) => {
        setOptimistic(!checked);
        await toggleItemAction(fd);
      }}
      className="flex-1"
    >
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="checked" value={String(!checked)} />
      <label className="flex cursor-pointer items-center gap-3 py-1">
        <input type="checkbox" checked={optimistic} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="h-5 w-5 accent-emerald-700" />
        <span className={optimistic ? "text-zinc-400 line-through" : ""}>{label}</span>
      </label>
    </form>
  );
}

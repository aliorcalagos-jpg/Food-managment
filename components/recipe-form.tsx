"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/app/actions/types";
import { SubmitButton } from "./form-field";

export type RecipeFormValues = {
  title: string;
  servings: number;
  sourceUrl: string;
  tags: string;
  instructions: string;
  ingredients: { name: string; quantity: string; unit: string }[];
};

type Row = RecipeFormValues["ingredients"][number] & { key: number };

const UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb"];
const input =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function RecipeForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: RecipeFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Inputs are controlled so values survive React resetting the form after a failed submit.
  const [v, setV] = useState({ ...initial, servings: String(initial.servings) });
  const nextKey = useRef(initial.ingredients.length + 1);
  const [rows, setRows] = useState<Row[]>(
    (initial.ingredients.length ? initial.ingredients : [{ name: "", quantity: "", unit: "" }]).map((r, i) => ({ ...r, key: i })),
  );
  const err = state?.errors ?? {};

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form action={formAction} className="space-y-5">
      <label className="block text-sm font-medium">
        Title
        <input name="title" required maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={input} />
        {err.title && <span className="mt-1 block text-sm text-red-600">{err.title}</span>}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">
          Servings
          <input name="servings" type="number" min={1} max={100} required value={v.servings} onChange={(e) => setV({ ...v, servings: e.target.value })} className={input} />
          {err.servings && <span className="mt-1 block text-sm text-red-600">{err.servings}</span>}
        </label>
        <label className="block text-sm font-medium">
          Tags (comma separated)
          <input name="tags" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="dinner, quick" className={input} />
          {err.tags && <span className="mt-1 block text-sm text-red-600">{err.tags}</span>}
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Ingredients</legend>
        <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[4.5rem_5rem_1fr_auto] items-center gap-2">
            <input name="ing_qty" aria-label={`Quantity ${i + 1}`} inputMode="decimal" placeholder="1/2" value={r.quantity} onChange={(e) => setRow(r.key, { quantity: e.target.value })} className={input.replace("mt-1 ", "")} />
            <input name="ing_unit" aria-label={`Unit ${i + 1}`} list="units" placeholder="unit" value={r.unit} onChange={(e) => setRow(r.key, { unit: e.target.value })} className={input.replace("mt-1 ", "")} />
            <input name="ing_name" aria-label={`Ingredient ${i + 1}`} placeholder="flour" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} className={input.replace("mt-1 ", "")} />
            <button type="button" aria-label={`Remove ingredient ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="px-2 text-zinc-500 hover:text-red-600 disabled:opacity-30">
              ✕
            </button>
          </div>
        ))}
        {err.ingredients && <p className="text-sm text-red-600">{err.ingredients}</p>}
        <button type="button" onClick={() => setRows((rs) => [...rs, { key: nextKey.current++, name: "", quantity: "", unit: "" }])} className="text-sm underline">
          + Add ingredient
        </button>
      </fieldset>

      <label className="block text-sm font-medium">
        Instructions
        <textarea name="instructions" rows={8} maxLength={20000} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} className={input} />
      </label>

      <label className="block text-sm font-medium">
        Source link (optional)
        <input name="sourceUrl" type="url" placeholder="https://" value={v.sourceUrl} onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} className={input} />
        {err.sourceUrl && <span className="mt-1 block text-sm text-red-600">{err.sourceUrl}</span>}
      </label>

      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}

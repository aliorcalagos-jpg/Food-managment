import { useState } from "react";
import { categorize } from "../../../lib/categories";
import { groupItems } from "../../../lib/list-build";
import { formatQuantity, parseQuantity } from "../../../lib/quantity";
import { addDays, formatRange, parseISODate, startOfWeek, toISODate } from "../../../lib/week";
import { addItem, clearChecked, generateList, removeItem, toggleItem, type PlanDay, type Recipe, type ShoppingList } from "../model";
import type { Store } from "../store";
import { todayISO } from "../today";
import { ConfirmAction, Empty, FieldError } from "./common";

type View = { kind: "index" } | { kind: "detail"; id: string };

export function Lists({ store, lists, recipes, days }: { store: Store; lists: ShoppingList[]; recipes: Recipe[]; days: PlanDay[] }) {
  const [view, setView] = useState<View>({ kind: "index" });
  if (view.kind === "detail") {
    return <ListDetail store={store} list={lists.find((l) => l.id === view.id)} onBack={() => setView({ kind: "index" })} />;
  }
  return <ListIndex store={store} lists={lists} recipes={recipes} days={days} onOpen={(id) => setView({ kind: "detail", id })} />;
}

function ListIndex({ store, lists, recipes, days, onOpen }: { store: Store; lists: ShoppingList[]; recipes: Recipe[]; days: PlanDay[]; onOpen: (id: string) => void }) {
  const monday = startOfWeek(parseISODate(todayISO())!);
  const [v, setV] = useState({ name: "", start: toISODate(monday), end: toISODate(addDays(monday, 6)) });
  const [error, setError] = useState<string | null>(null);
  const [blank, setBlank] = useState("");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const result = generateList(v, recipes, days);
    if (!result.ok) return setError(result.error);
    setError(null);
    const id = await store.createList({ ...result.list, createdAt: new Date().toISOString() });
    if (id) onOpen(id);
  }

  async function createBlank(e: React.FormEvent) {
    e.preventDefault();
    const name = blank.trim();
    if (!name) return;
    const id = await store.createList({ name, rangeStart: null, rangeEnd: null, createdAt: new Date().toISOString(), items: [] });
    if (id) {
      setBlank("");
      onOpen(id);
    }
  }

  const sorted = [...lists].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section aria-labelledby="lists-h" className="stack">
      <h2 id="lists-h">Shopping lists</h2>

      <form onSubmit={generate} className="card stack" noValidate>
        <h3>New list from your meal plan</h3>
        <div className="two">
          <div className="field">
            <label htmlFor="gen-start">From</label>
            <input id="gen-start" type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="gen-end">To</label>
            <input id="gen-end" type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} aria-describedby="gen-err" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="gen-name">Name (optional)</label>
          <input id="gen-name" maxLength={80} placeholder="e.g. Saturday shop" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <FieldError id="gen-err">{error}</FieldError>
        <button type="submit" className="btn primary">
          Generate from meal plan
        </button>
      </form>

      <form onSubmit={createBlank} className="inline-form">
        <label className="sr-only" htmlFor="blank-name">
          New empty list name
        </label>
        <input id="blank-name" maxLength={80} placeholder="Or start an empty list" value={blank} onChange={(e) => setBlank(e.target.value)} />
        <button type="submit" className="btn ghost">
          Create
        </button>
      </form>

      {sorted.length === 0 ? (
        <Empty title="No lists yet">Plan some meals, then generate one above.</Empty>
      ) : (
        <ul className="rows">
          {sorted.map((l) => {
            const done = l.items.filter((i) => i.checked).length;
            return (
              <li key={l.id}>
                <button type="button" className="row-btn" onClick={() => onOpen(l.id)}>
                  <span className="row-title">
                    {l.name}
                    {l.rangeStart && l.rangeEnd && (
                      <span className="muted num"> · {formatRange(parseISODate(l.rangeStart)!, parseISODate(l.rangeEnd)!)}</span>
                    )}
                  </span>
                  <span className="muted num">
                    {done} of {l.items.length} done
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ListDetail({ store, list, onBack }: { store: Store; list: ShoppingList | undefined; onBack: () => void }) {
  const [item, setItem] = useState({ quantity: "", unit: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  if (!list) {
    return (
      <Empty title="That list isn't here any more">
        <button type="button" className="link" onClick={onBack}>
          Back to lists
        </button>
      </Empty>
    );
  }

  const done = list.items.filter((i) => i.checked).length;
  const update = (edit: (l: ShoppingList) => ShoppingList) => store.updateList(list.id, edit);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = item.name.trim();
    if (!name) return setError("Enter an item name.");
    const quantity = item.quantity.trim() === "" ? 1 : parseQuantity(item.quantity);
    if (quantity === null || quantity > 100000) return setError("Use a number like 2, 0.5 or 1/2.");
    setError(null);
    void update((l) => addItem(l, { name, quantity, unit: item.unit.trim(), category: categorize(name) }));
    setItem({ quantity: "", unit: "", name: "" });
  }

  return (
    <section className="stack">
      <button type="button" className="link" onClick={onBack}>
        ← All lists
      </button>
      <div className="page-head">
        <h2>{list.name}</h2>
        <ConfirmAction
          label="Delete list"
          confirmLabel="Delete this list"
          onConfirm={async () => {
            await store.deleteList(list.id);
            onBack();
          }}
        />
      </div>
      <p className="muted num">
        {list.rangeStart && list.rangeEnd && <>{formatRange(parseISODate(list.rangeStart)!, parseISODate(list.rangeEnd)!)} · </>}
        <span aria-live="polite">
          {done} of {list.items.length} done
        </span>
      </p>

      <form onSubmit={add} className="add-item" noValidate>
        <label className="sr-only" htmlFor="item-qty">Quantity</label>
        <input id="item-qty" inputMode="decimal" placeholder="1" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
        <label className="sr-only" htmlFor="item-unit">Unit</label>
        <input id="item-unit" placeholder="unit" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} />
        <label className="sr-only" htmlFor="item-name">Item name</label>
        <input id="item-name" placeholder="Add an item" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
        <button type="submit" className="btn primary">Add</button>
      </form>
      <FieldError id="item-err">{error}</FieldError>

      {list.items.length === 0 && <Empty title="This list is empty">Add your first item above.</Empty>}

      {groupItems(list.items).map((g) => (
        <section key={g.category} aria-label={g.category} className="aisle">
          <h3 className="aisle-title">{g.category}</h3>
          <ul className="rows tight">
            {g.items.map((i) => (
              <li key={i.id} className="item">
                <ItemCheck
                  checked={i.checked}
                  label={[formatQuantity(i.quantity), i.unit, i.name].filter(Boolean).join(" ")}
                  onChange={(next) => update((l) => toggleItem(l, i.id, next))}
                />
                <button type="button" className="icon-btn" aria-label={`Remove ${i.name}`} onClick={() => void update((l) => removeItem(l, i.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {done > 0 && (
        <ConfirmAction
          label={`Clear ${done} checked item${done === 1 ? "" : "s"}`}
          confirmLabel="Remove checked items"
          className="link"
          onConfirm={() => void update(clearChecked)}
        />
      )}
    </section>
  );
}

/**
 * Flips at once and saves in the background. It shows the viewer's tap until the save settles,
 * then goes back to the stored value, so a failed save un-ticks the box instead of lying.
 */
function ItemCheck({ checked, label, onChange }: { checked: boolean; label: string; onChange: (next: boolean) => Promise<unknown> }) {
  const [pending, setPending] = useState<boolean | null>(null);
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={pending ?? checked}
        onChange={(e) => {
          setPending(e.target.checked);
          void onChange(e.target.checked).then(() => setPending(null));
        }}
      />
      <span className={(pending ?? checked) ? "done num" : "num"}>{label}</span>
    </label>
  );
}

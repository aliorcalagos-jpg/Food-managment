import { useState, type ReactNode } from "react";
import { currencySymbol, editableAmount, parseMoney } from "../../../lib/money";
import { categorize } from "../../../lib/categories";
import { groupItems } from "../../../lib/list-build";
import { parseQuantity } from "../../../lib/quantity";
import { addDays, formatRange, parseISODate, startOfWeek, toISODate } from "../../../lib/week";
import { aisleLabel, useI18n, type Msg } from "../i18n";
import { addItem, clearChecked, generateList, removeItem, setItemPrice, setShoppedOn, toggleItem, type PlanDay, type Recipe, type ShoppingList } from "../model";
import { useMoney } from "../money-context";
import { listTotals } from "../spending";
import type { Store } from "../store";
import { todayISO } from "../today";
import { Arrow, ConfirmAction, Empty, FieldError, ItemLabel, Money } from "./common";

type View = { kind: "index" } | { kind: "detail"; id: string; skipped?: string[] };

export function Lists({
  store,
  lists,
  recipes,
  days,
  initialListId,
}: {
  store: Store;
  lists: ShoppingList[];
  recipes: Recipe[];
  days: PlanDay[];
  /** Open this list straight away (used when jumping here from the Expenses tab). */
  initialListId?: string | null;
}) {
  const [view, setView] = useState<View>(initialListId ? { kind: "detail", id: initialListId } : { kind: "index" });
  if (view.kind === "detail") {
    return <ListDetail store={store} list={lists.find((l) => l.id === view.id)} skipped={view.skipped} onBack={() => setView({ kind: "index" })} />;
  }
  return <ListIndex store={store} lists={lists} recipes={recipes} days={days} onOpen={(id, skipped) => setView({ kind: "detail", id, skipped })} />;
}

function ListIndex({ store, lists, recipes, days, onOpen }: { store: Store; lists: ShoppingList[]; recipes: Recipe[]; days: PlanDay[]; onOpen: (id: string, skipped?: string[]) => void }) {
  const { t, lang } = useI18n();
  const monday = startOfWeek(parseISODate(todayISO())!);
  const [v, setV] = useState({ name: "", start: toISODate(monday), end: toISODate(addDays(monday, 6)) });
  const [error, setError] = useState<Msg | null>(null);
  const [blank, setBlank] = useState("");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    // a default name in the current language, e.g. "وجبات 12 أكتوبر – 18 أكتوبر 2026"
    const [a, b] = [parseISODate(v.start), parseISODate(v.end)];
    const fallback = a && b ? t("defaultListName", { range: formatRange(a, b, lang) }) : "";
    const result = generateList({ ...v, name: v.name.trim() || fallback, shoppedOn: todayISO() }, recipes, days);
    if (!result.ok) return setError(result.error);
    setError(null);
    const id = await store.createList({ ...result.list, createdAt: new Date().toISOString() });
    if (id) onOpen(id, result.skipped);
  }

  async function createBlank(e: React.FormEvent) {
    e.preventDefault();
    const name = blank.trim();
    if (!name) return;
    const id = await store.createList({ name, rangeStart: null, rangeEnd: null, createdAt: new Date().toISOString(), shoppedOn: todayISO(), items: [] });
    if (id) {
      setBlank("");
      onOpen(id);
    }
  }

  const sorted = [...lists].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section aria-labelledby="lists-h" className="stack">
      <h2 id="lists-h">{t("listsH")}</h2>

      <form onSubmit={generate} className="card stack" noValidate>
        <h3>{t("newListFromPlan")}</h3>
        <div className="two">
          <div className="field">
            <label htmlFor="gen-start">{t("from")}</label>
            <input id="gen-start" type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="gen-end">{t("to")}</label>
            <input id="gen-end" type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} aria-describedby="gen-err" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="gen-name">{t("listName")}</label>
          <input id="gen-name" dir="auto" maxLength={80} placeholder={t("phListName")} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <FieldError id="gen-err" msg={error} />
        <button type="submit" className="btn primary">
          {t("generate")}
        </button>
      </form>

      <form onSubmit={createBlank} className="inline-form">
        <label className="sr-only" htmlFor="blank-name">
          {t("blankLabel")}
        </label>
        <input id="blank-name" dir="auto" maxLength={80} placeholder={t("phBlank")} value={blank} onChange={(e) => setBlank(e.target.value)} />
        <button type="submit" className="btn ghost">
          {t("create")}
        </button>
      </form>

      {sorted.length === 0 ? (
        <Empty title={t("noLists")}>{t("noListsHint")}</Empty>
      ) : (
        <ul className="rows">
          {sorted.map((l) => {
            const done = l.items.filter((i) => i.checked).length;
            return (
              <li key={l.id}>
                <button type="button" className="row-btn" onClick={() => onOpen(l.id)}>
                  <span className="row-title">
                    <bdi>{l.name}</bdi>
                    {l.rangeStart && l.rangeEnd && (
                      <span className="muted num"> · {formatRange(parseISODate(l.rangeStart)!, parseISODate(l.rangeEnd)!, lang)}</span>
                    )}
                  </span>
                  <span className="muted num">{t("progress", { done, total: l.items.length })}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ListDetail({ store, list, skipped, onBack }: { store: Store; list: ShoppingList | undefined; skipped?: string[]; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [item, setItem] = useState({ quantity: "", unit: "", name: "" });
  const [error, setError] = useState<Msg | null>(null);
  const [noteOpen, setNoteOpen] = useState(true);

  if (!list) {
    return (
      <Empty title={t("listGone")}>
        <button type="button" className="link" onClick={onBack}>
          {t("backToListsPlain")}
        </button>
      </Empty>
    );
  }

  const done = list.items.filter((i) => i.checked).length;
  const totals = listTotals(list);
  const update = (edit: (l: ShoppingList) => ShoppingList) => store.updateList(list.id, edit);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = item.name.trim();
    if (!name) return setError({ key: "errItemName" });
    const quantity = item.quantity.trim() === "" ? 1 : parseQuantity(item.quantity);
    if (quantity === null || quantity > 100000) return setError({ key: "errItemQty" });
    setError(null);
    void update((l) => addItem(l, { name, quantity, unit: item.unit.trim(), category: categorize(name) }));
    setItem({ quantity: "", unit: "", name: "" });
  }

  return (
    <section className="stack">
      <button type="button" className="link" onClick={onBack}>
        <Arrow /> {t("backToLists")}
      </button>
      <div className="page-head">
        <h2 dir="auto">{list.name}</h2>
        <ConfirmAction
          label={t("deleteList")}
          confirmLabel={t("deleteListConfirm")}
          onConfirm={async () => {
            await store.deleteList(list.id);
            onBack();
          }}
        />
      </div>
      <p className="muted num">
        {list.rangeStart && list.rangeEnd && <>{formatRange(parseISODate(list.rangeStart)!, parseISODate(list.rangeEnd)!, lang)} · </>}
        <span aria-live="polite">{t("progress", { done, total: list.items.length })}</span>
      </p>

      <div className="trip-meta">
        <div className="field">
          <label htmlFor="shopped-on">{t("shoppedOn")}</label>
          <input id="shopped-on" type="date" value={list.shoppedOn} onChange={(e) => {
            // read the value now: the update runs later, after React has reset this controlled input
            const date = e.target.value;
            if (date) void update((l) => setShoppedOn(l, date));
          }} />
        </div>
        {(totals.spent > 0 || totals.planned > 0) && (
          <p className="totals num">
            {t("boughtTotal")} <Money kobo={totals.spent} withOther />
            {totals.planned > 0 && (
              <>
                {" · "}
                {t("plannedTotal")} <Money kobo={totals.planned} />
              </>
            )}
            {totals.unpriced > 0 && <span className="muted"> · {totals.unpriced === 1 ? t("unpricedOne") : t("unpricedN", { n: totals.unpriced })}</span>}
          </p>
        )}
      </div>

      {skipped && skipped.length > 0 && noteOpen && (
        <div className="banner" role="note">
          <span>{t("noteSkipped", { names: skipped.join(" · ") })}</span>
          <button type="button" className="link" onClick={() => setNoteOpen(false)}>
            {t("dismiss")}
          </button>
        </div>
      )}

      <form onSubmit={add} className="add-item" noValidate>
        <label className="sr-only" htmlFor="item-qty">{t("itemQty")}</label>
        <input id="item-qty" inputMode="decimal" placeholder="1" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
        <label className="sr-only" htmlFor="item-unit">{t("itemUnit")}</label>
        <input id="item-unit" dir="auto" placeholder={t("phUnit")} value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} />
        <label className="sr-only" htmlFor="item-name">{t("itemName")}</label>
        <input id="item-name" dir="auto" placeholder={t("phItemName")} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
        <button type="submit" className="btn primary">{t("add")}</button>
      </form>
      <FieldError id="item-err" msg={error} />

      {list.items.length === 0 && <Empty title={t("listEmpty")}>{t("listEmptyHint")}</Empty>}

      {groupItems(list.items).map((g) => (
        <section key={g.category} aria-label={aisleLabel(lang, g.category)} className="aisle">
          <h3 className="aisle-title">{aisleLabel(lang, g.category)}</h3>
          <ul className="rows tight">
            {g.items.map((i) => (
              <li key={i.id} className="item">
                <ItemCheck
                  checked={i.checked}
                  label={<ItemLabel quantity={i.quantity} unit={i.unit} name={i.name} />}
                  onChange={(next) => update((l) => toggleItem(l, i.id, next))}
                />
                <PriceInput id={i.id} name={i.name} price={i.price} onCommit={(p) => void update((l) => setItemPrice(l, i.id, p))} />
                <button type="button" className="icon-btn" aria-label={t("removeItem", { name: i.name })} onClick={() => void update((l) => removeItem(l, i.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {done > 0 && (
        <ConfirmAction label={done === 1 ? t("clearChecked1") : t("clearCheckedN", { n: done })} confirmLabel={t("clearCheckedConfirm")} className="link" onConfirm={() => void update(clearChecked)} />
      )}
    </section>
  );
}

/**
 * Flips at once and saves in the background. It shows the viewer's tap until the save settles,
 * then goes back to the stored value, so a failed save un-ticks the box instead of lying.
 */
function ItemCheck({ checked, label, onChange }: { checked: boolean; label: ReactNode; onChange: (next: boolean) => Promise<unknown> }) {
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

/**
 * What one shopping line cost, typed in the chosen currency (naira or dollars at the fixed rate) and
 * stored as whole naira kobo. Saved when you leave the box or press Enter; blank clears the price.
 */
function PriceInput({ id, name, price, onCommit }: { id: string; name: string; price: number | null; onCommit: (kobo: number | null) => void }) {
  const { t } = useI18n();
  const { currency, rate } = useMoney();
  const shown = price === null ? "" : editableAmount(price, currency, rate);
  const [draft, setDraft] = useState(shown);
  const [synced, setSynced] = useState(shown);
  const [bad, setBad] = useState(false);
  if (synced !== shown) {
    // the stored price (or the currency) changed: show it
    setSynced(shown);
    setDraft(shown);
    setBad(false);
  }

  function commit() {
    if (draft.trim() === "") {
      setBad(false);
      if (price !== null) onCommit(null);
      return;
    }
    const kobo = parseMoney(draft, currency, rate);
    if (kobo === null) return setBad(true);
    setBad(false);
    setDraft(editableAmount(kobo, currency, rate));
    if (kobo !== price) onCommit(kobo);
  }

  return (
    <span className="price">
      <span className="price-symbol" aria-hidden="true">
        {currencySymbol(currency)}
      </span>
      <label className="sr-only" htmlFor={`price-${id}`}>
        {t("priceFor", { name })}
      </label>
      <input
        id={`price-${id}`}
        dir="ltr"
        inputMode="decimal"
        className="price-input num"
        placeholder="0"
        value={draft}
        aria-invalid={bad || undefined}
        title={bad ? t("errPrice") : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </span>
  );
}

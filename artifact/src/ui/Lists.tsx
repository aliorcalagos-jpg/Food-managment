import { useState, type ReactNode } from "react";
import { currencySymbol, editableAmount, parseMoney } from "../../../lib/money";
import { categorize } from "../../../lib/categories";
import { groupItems } from "../../../lib/list-build";
import { parseIngredientLine } from "../../../lib/ingredient-line";
import { parseQuantity } from "../../../lib/quantity";
import { formatRange, parseISODate } from "../../../lib/week";
import { aisleLabel, useI18n, type Msg } from "../i18n";
import { addItem, clearChecked, removeItem, setItemPrice, setShoppedOn, toggleItem, type ShoppingList } from "../model";
import { useMoney } from "../money-context";
import { listTotals } from "../spending";
import type { Store } from "../store";
import { todayISO } from "../today";
import { catalogItemFor, type Look } from "../../../lib/catalog";
import { buildBuyList, restoreItem, type Recipe, type WeekPlan } from "../model";
import { haptic } from "../native";
import { Burst, useToast } from "./motion";
import { AisleSummary, Arrow, ConfirmAction, Empty, FieldError, ItemLabel, Money, NeededFor, SwipeRow, sourcesLookup } from "./common";
import { FoodIcon } from "./FoodIcon";

type View = { kind: "index" } | { kind: "detail"; id: string };

export function Lists({
  store,
  lists,
  recipes,
  weeks,
  initialListId,
}: {
  store: Store;
  lists: ShoppingList[];
  /** With the weeks, they say which foods need each line of a week's list. */
  recipes: Recipe[];
  weeks: WeekPlan[];
  /** Open this list straight away (used when jumping here from the Expenses tab). */
  initialListId?: string | null;
}) {
  const [view, setView] = useState<View>(initialListId ? { kind: "detail", id: initialListId } : { kind: "index" });
  if (view.kind === "detail") {
    return <ListDetail store={store} list={lists.find((l) => l.id === view.id)} recipes={recipes} weeks={weeks} onBack={() => setView({ kind: "index" })} />;
  }
  return <ListIndex store={store} lists={lists} onOpen={(id) => setView({ kind: "detail", id })} />;
}

function ListIndex({ store, lists, onOpen }: { store: Store; lists: ShoppingList[]; onOpen: (id: string) => void }) {
  const { t, lang } = useI18n();
  const [blank, setBlank] = useState("");

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
      <h2 id="lists-h" className="large-title">{t("listsH")}</h2>

      {sorted.length === 0 ? (
        <Empty title={t("noLists")}>{t("noListsHint")}</Empty>
      ) : (
        <ul className="list-cards">
          {sorted.map((l) => {
            const done = l.items.filter((i) => i.checked).length;
            return (
              <li key={l.id}>
                <button type="button" className="list-card" data-pilot={l === sorted[0] ? "list-card" : undefined} onClick={() => onOpen(l.id)}>
                  <span className="list-card-top">
                    <bdi className="row-title">{l.name}</bdi>
                    <span className="muted num">{t("progress", { done, total: l.items.length })}</span>
                  </span>
                  {l.rangeStart && l.rangeEnd && <span className="muted num">{formatRange(parseISODate(l.rangeStart)!, parseISODate(l.rangeEnd)!, lang)}</span>}
                  <span className="progress" aria-hidden="true">
                    <span className="progress-fill" style={{ display: "block", width: `${l.items.length ? (done / l.items.length) * 100 : 0}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={createBlank} className="inline-form">
        <label className="sr-only" htmlFor="blank-name">
          {t("blankLabel")}
        </label>
        <input id="blank-name" dir="auto" maxLength={80} placeholder={t("phBlank")} value={blank} onChange={(e) => setBlank(e.target.value)} />
        <button type="submit" className="btn ghost">
          {t("create")}
        </button>
      </form>
      <p className="muted hint">{t("listsHint")}</p>
    </section>
  );
}

function ListDetail({ store, list, recipes, weeks, onBack }: { store: Store; list: ShoppingList | undefined; recipes: Recipe[]; weeks: WeekPlan[]; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [line, setLine] = useState("");
  const [error, setError] = useState<Msg | null>(null);
  const [basketOpen, setBasketOpen] = useState(true);
  const [burst, setBurst] = useState(false);
  const toast = useToast();

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
  const total = list.items.length;
  const totals = listTotals(list);
  const update = (edit: (l: ShoppingList) => ShoppingList) => store.updateList(list.id, edit);
  const pending = list.items.filter((i) => !i.checked);
  const pilotFirst = (pending[0] ?? list.items[0])?.id; // the row Pilot points at
  const basket = list.items.filter((i) => i.checked);
  // the week this list belongs to knows which foods need each line
  const week = weeks.find((w) => w.listId === list.id);
  const sourcesOf = sourcesLookup(week ? buildBuyList(week.picks, recipes).sources : new Map());

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!line.trim()) return;
    const f = parseIngredientLine(line);
    const name = f.name.trim();
    if (!name) return setError({ key: "errItemName" });
    const quantity = f.quantity === "" ? 1 : parseQuantity(f.quantity);
    if (quantity === null || quantity > 100000) return setError({ key: "errItemQty" });
    setError(null);
    void update((l) => addItem(l, { name, quantity, unit: f.unit, category: categorize(name) }));
    setLine("");
  }

  const complete = total > 0 && done === total;
  /** Ticks or un-ticks a line. Ticking the last one finishes the trip: sparks and a buzz. */
  const toggle = (id: string, next: boolean) => {
    if (next) markTicked(id);
    if (next && total > 0 && done + 1 === total) {
      setBurst(true);
      haptic("success");
    } else haptic("tick");
    return update((l) => toggleItem(l, id, next));
  };
  /** Removes a line at once and offers to put it back, instead of asking first. */
  const remove = (i: ShoppingList["items"][number]) => {
    const at = list.items.findIndex((x) => x.id === i.id);
    const dismissed = list.dismissed;
    void update((l) => removeItem(l, i.id));
    haptic("thud");
    toast({ text: t("itemRemoved", { name: i.name }), action: { label: t("undo"), run: () => void update((l) => restoreItem(l, i, at, dismissed)) } });
  };

  const row = (i: ShoppingList["items"][number]) => (
    <SwipeRow
      key={i.id}
      contentClass="item"
      deleteLabel={t("delete")}
      toggleLabel={i.checked ? t("undo") : t("done")}
      onDelete={() => remove(i)}
      onToggle={() => void toggle(i.id, !i.checked)}
    >
      <ItemCheck id={i.id} pilot={pilotFirst === i.id} checked={i.checked} icon={catalogItemFor(i.name)?.look} label={<ItemLabel quantity={i.quantity} unit={i.unit} name={i.name} />} note={i.fromPlan ? <NeededFor sources={sourcesOf(i)} /> : null} noteId={`need-${i.id}`} onChange={(next) => toggle(i.id, next)} />
      <PriceInput id={i.id} name={i.name} price={i.price} pilot={pilotFirst === i.id} onCommit={(p) => void update((l) => setItemPrice(l, i.id, p))} />
      <button type="button" className="icon-btn row-remove" aria-label={t("removeItem", { name: i.name })} onClick={() => remove(i)}>
        ✕
      </button>
    </SwipeRow>
  );

  return (
    <section className="stack" data-pilot="list-detail">
      <button type="button" className="back" onClick={onBack}>
        <Arrow /> {t("backToLists")}
      </button>
      <div className="stack" style={{ gap: 10 }}>
        <h2 dir="auto">{list.name}</h2>
        <p className="muted num">
          {list.rangeStart && list.rangeEnd && <>{formatRange(parseISODate(list.rangeStart)!, parseISODate(list.rangeEnd)!, lang)} · </>}
          <span aria-live="polite">{t("progress", { done, total })}</span>
        </p>
        <div className="progress" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        {complete && (
          <p className="complete num" role="status">
            <strong>{t("shopComplete")}</strong> · <Money kobo={totals.spent} />
            {burst && <Burst onDone={() => setBurst(false)} />}
          </p>
        )}
      </div>

      <form onSubmit={add} className="add-item" noValidate>
        <label className="sr-only" htmlFor="item-line">
          {t("itemLineLabel")}
        </label>
        <input id="item-line" dir="auto" placeholder={t("phItemLine")} value={line} onChange={(e) => setLine(e.target.value)} />
        <button type="submit" className="btn primary">
          {t("add")}
        </button>
      </form>
      <FieldError id="item-err" msg={error} />

      {total === 0 && <Empty title={t("listEmpty")}>{t("listEmptyHint")}</Empty>}

      {groupItems(pending).map((g) => (
        <section key={g.category} aria-label={aisleLabel(lang, g.category)} className="aisle">
          <h3 className="aisle-title">{aisleLabel(lang, g.category)}</h3>
          {week && <AisleSummary category={g.category} items={g.items} sourcesOf={sourcesOf} />}
          <ul className="items">{g.items.map(row)}</ul>
        </section>
      ))}

      {basket.length > 0 && (
        <section className="aisle" aria-label={t("basketH", { n: basket.length })}>
          <button type="button" className="basket-toggle" aria-expanded={basketOpen} onClick={() => setBasketOpen((o) => !o)}>
            <span aria-hidden="true">{basketOpen ? "▾" : "▸"}</span> {t("basketH", { n: basket.length })}
          </button>
          {basketOpen && <ul className="items">{basket.map(row)}</ul>}
        </section>
      )}

      <details className="more">
        <summary>{t("moreH")}</summary>
        <div className="stack">
          <div className="field">
            <label htmlFor="shopped-on">{t("shoppedOn")}</label>
            <input
              id="shopped-on"
              type="date"
              value={list.shoppedOn}
              onChange={(e) => {
                // read the value now: the update runs later, after React has reset this controlled input
                const date = e.target.value;
                if (date) void update((l) => setShoppedOn(l, date));
              }}
            />
          </div>
          {done > 0 && (
            <div>
              <ConfirmAction label={done === 1 ? t("clearChecked1") : t("clearCheckedN", { n: done })} confirmLabel={t("clearCheckedConfirm")} className="btn ghost" onConfirm={() => void update(clearChecked)} />
            </div>
          )}
          <div>
            <ConfirmAction
              label={t("deleteList")}
              confirmLabel={t("deleteListConfirm")}
              className="btn ghost"
              onConfirm={async () => {
                await store.deleteList(list.id);
                onBack();
              }}
            />
          </div>
        </div>
      </details>

      <div className="sticky-bar">
        <div className="sticky-in" data-pilot="trip-bar">
          <p className="trip-bar num" aria-live="polite">
            <strong>
              {t("boughtTotal")} <Money kobo={totals.spent} withOther />
            </strong>
            <span>
              {totals.planned > 0 && (
                <>
                  {t("plannedTotal")} <Money kobo={totals.planned} />
                  {" · "}
                </>
              )}
              {totals.unpriced > 0 ? (totals.unpriced === 1 ? t("unpricedOne") : t("unpricedN", { n: totals.unpriced })) : totals.spent + totals.planned === 0 ? t("priceHint") : ""}
            </span>
          </p>
        </div>
      </div>
      <div style={{ height: 72 }} aria-hidden="true" />
    </section>
  );
}

/**
 * Flips at once and saves in the background. It shows the viewer's tap until the save settles,
 * then goes back to the stored value, so a failed save un-ticks the box instead of lying.
 */
const tickedAt = new Map<string, number>();
const markTicked = (id: string) => void tickedAt.set(id, Date.now());
/** A line you ticked a moment ago (it may have moved to the basket since, which mounts it afresh): it gets the tick stamp. */
const justTicked = (id: string) => Date.now() - (tickedAt.get(id) ?? 0) < 1500;

function ItemCheck({ id, checked, label, note, noteId, icon, pilot, onChange }: { id: string; checked: boolean; label: ReactNode; note?: ReactNode; noteId?: string; icon?: Look; pilot?: boolean; onChange: (next: boolean) => Promise<unknown> }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [stamp] = useState(() => justTicked(id));
  return (
    <label className="check" data-pilot={pilot ? "tick" : undefined}>
      <input
        type="checkbox"
        className={stamp ? "stamp" : undefined}
        aria-labelledby={note ? `${noteId}-name` : undefined}
        aria-describedby={note ? noteId : undefined}
        checked={pending ?? checked}
        onChange={(e) => {
          if (e.target.checked) markTicked(id);
          setPending(e.target.checked);
          void onChange(e.target.checked).then(() => setPending(null));
        }}
      />
      {icon ? <FoodIcon look={icon} size={34} /> : <span className="ing-icon-gap" aria-hidden="true" />}
      <span className="check-text">
        <span id={note ? `${noteId}-name` : undefined} className={(pending ?? checked) ? "done num" : "num"}>{label}</span>
        {note && <span id={noteId} className="num">{note}</span>}
      </span>
    </label>
  );
}

/**
 * What one shopping line cost, typed in the chosen currency (naira or dollars at the fixed rate) and
 * stored as whole naira kobo. Saved when you leave the box or press Enter; blank clears the price.
 */
function PriceInput({ id, name, price, pilot, onCommit }: { id: string; name: string; price: number | null; pilot?: boolean; onCommit: (kobo: number | null) => void }) {
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
    <span className="price" data-pilot={pilot ? "price" : undefined}>
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

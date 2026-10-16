import { useMemo, useRef, useState } from "react";
import { normalizeArabic } from "../../../lib/arabic";
import { CATALOG, catalogItemFor, catalogName, GROUPS, searchCatalog, type CatalogGroup, type CatalogItem, type CatalogUnit, type Look } from "../../../lib/catalog";
import { parseIngredientLine, splitIngredientText, type IngredientFields } from "../../../lib/ingredient-line";
import { normalizeName } from "../../../lib/ingredients";
import { formatQuantity, parseQuantity } from "../../../lib/quantity";
import type { Lang } from "../i18n";
import { useI18n } from "../i18n";
import { memoryKey, withRows, type Memory } from "../memory";
import { FoodIcon } from "./FoodIcon";
import { Sheet } from "./common";

export type IngRow = { name: string; quantity: string; unit: string };

const QUANTITY_CHIPS = ["1/2", "1", "2", "3", "5", "100", "250", "500"];
const UNIT_CHIPS: Record<Lang, string[]> = {
  ar: ["كوب", "جم", "كيلو", "حبة", "ملعقة كبيرة", "ملعقة صغيرة", "مل", "لتر"],
  en: ["cup", "g", "kg", "piece", "tbsp", "tsp", "ml", "l"],
};
const CANON_UNITS: CatalogUnit[] = ["cup", "g", "kg", "piece", "tbsp", "tsp", "ml", "l"]; // same order as UNIT_CHIPS
const GROUP_LABEL = {
  vegetables: "catVegetables",
  meat: "catMeat",
  chicken: "catChicken",
  fish: "catFish",
  legumes: "catLegumes",
  dairy: "catDairy",
  oils: "catOils",
  spices: "catSpices",
} as const;
const fold = (s: string) => normalizeArabic(s).toLowerCase();
const compose = (f: IngredientFields) => [f.quantity, f.unit, f.name].filter(Boolean).join(" ");
const quantityOk = (q: string) => {
  const n = parseQuantity(q);
  return n !== null && n <= 100000;
};

/**
 * Adds or edits ingredients one at a time. Type a line ("2 كوب أرز"), or tap quantity and unit chips; a live
 * preview shows how it was understood. Add keeps the sheet open for the next ingredient.
 */
export function IngredientSheet({
  rows,
  index,
  knownNames,
  memory,
  onAdd,
  onReplace,
  onClose,
}: {
  rows: IngRow[];
  /** Which row is being edited, or null to add new ones. */
  index: number | null;
  knownNames: string[];
  /** What the person's own dishes say: the amount used last time per ingredient, and the ingredients used most. */
  memory: Memory;
  onAdd: (rows: IngRow[]) => void;
  onReplace: (index: number, row: IngRow) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const editing = index !== null ? rows[index] : undefined;
  const start: IngredientFields = editing ? { quantity: editing.quantity, unit: editing.unit, name: editing.name } : { quantity: "", unit: "", name: "" };
  const [text, setText] = useState(compose(start));
  const [f, setF] = useState<IngredientFields>(start);
  const [added, setAdded] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const [group, setGroup] = useState<CatalogGroup>("vegetables");
  // the usual unit of the last picked item: offered on its chip, and applied when a quantity is tapped
  const [usual, setUsual] = useState("");
  // pick several: tap many ingredients, then set every amount in one table
  type Picked = { name: string; look?: Look; unit: string; quantity: string };
  const [several, setSeveral] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [table, setTable] = useState(false);
  const mem = useMemo(() => withRows(memory, rows), [memory, rows]);
  const lastTime = useMemo(() => {
    const m = f.name.trim() ? mem.last.get(memoryKey(f.name.trim())) : undefined;
    return m && !f.quantity ? m : undefined;
  }, [mem, f.name, f.quantity]);

  const known = useMemo(() => new Map(knownNames.map((n) => [normalizeName(n), n])), [knownNames]);
  const snap = (name: string) => known.get(normalizeName(name)) ?? name;
  const valid = f.name.trim() !== "" && quantityOk(f.quantity);
  const parts = useMemo(() => splitIngredientText(text), [text]);
  const multi = parts.length > 1;
  const previewItem = f.name.trim() ? catalogItemFor(snap(f.name.trim())) : undefined;

  const set = (next: IngredientFields) => {
    setF(next);
    setText(compose(next));
  };
  const type = (value: string) => {
    setText(value);
    setF(parseIngredientLine(value));
  };

  const suggestions = useMemo(() => {
    const term = fold(f.name);
    return knownNames.filter((n) => (term ? fold(n).includes(term) && fold(n) !== term : true)).slice(0, 8);
  }, [knownNames, f.name]);

  // Typing searches the whole list; with nothing typed the chosen group is shown.
  const typed = f.name.trim();
  const found = useMemo(() => (typed ? searchCatalog(typed) : []), [typed]);
  const shown: CatalogItem[] = typed ? found : CATALOG.filter((i) => i.group === group);

  /** Picks a listed ingredient: its name, and its usual unit when none is chosen yet. The quantity is left for you. */
  function pick(item: CatalogItem) {
    const usualUnit = item.unit ? UNIT_CHIPS[lang][CANON_UNITS.indexOf(item.unit)] : "";
    // a unit can only sit in the line once there is a quantity before it, so until then it is only suggested
    set({ ...f, name: catalogName(item, lang), unit: f.unit || (f.quantity ? usualUnit : "") });
    setUsual(f.unit || !usualUnit ? "" : usualUnit);
    input.current?.focus();
  }

  /** Picks an ingredient by name (from "Used often"); the amount used last time is then offered. */
  function pickName(name: string) {
    const item = catalogItemFor(name);
    const usualUnit = item?.unit ? UNIT_CHIPS[lang][CANON_UNITS.indexOf(item.unit)] : "";
    set({ ...f, name, unit: f.unit || (f.quantity ? usualUnit : "") });
    setUsual(f.unit || !usualUnit ? "" : usualUnit);
    input.current?.focus();
  }

  const pickedKey = (name: string) => memoryKey(name);
  function toggleSeveral(name: string, look?: Look, unit = "") {
    setPicked((cur) => (cur.some((p) => pickedKey(p.name) === pickedKey(name)) ? cur.filter((p) => pickedKey(p.name) !== pickedKey(name)) : [...cur, { name, look, unit, quantity: "" }]));
  }
  function openTable() {
    setPicked((cur) =>
      cur.map((p) => {
        const m = mem.last.get(memoryKey(p.name));
        return m && p.quantity === "" ? { ...p, quantity: m.quantity, unit: m.unit } : p; // never over what you typed
      }),
    );
    setTable(true);
  }
  function addAll() {
    const rowsOut = picked.map((p) => ({ name: snap(p.name), quantity: p.quantity, unit: p.unit }));
    onAdd(rowsOut);
    setAdded((n) => n + rowsOut.length);
    setPicked([]);
    setTable(false);
    setSeveral(false);
  }
  const tableReady = picked.length > 0 && picked.every((p) => quantityOk(p.quantity));

  function add() {
    if (multi) {
      const parsed = parts.map(parseIngredientLine).filter((r) => r.name || r.quantity || r.unit).map((r) => ({ ...r, name: snap(r.name) }));
      if (parsed.length === 0) return;
      onAdd(parsed);
      setAdded((n) => n + parsed.length);
    } else if (valid) {
      const row = { name: snap(f.name.trim()), quantity: f.quantity, unit: f.unit };
      if (index !== null) {
        onReplace(index, row);
        return onClose();
      }
      onAdd([row]);
      setAdded((n) => n + 1);
    } else return;
    setText("");
    setF({ quantity: "", unit: "", name: "" });
    setUsual("");
    input.current?.focus();
  }

  const canAdd = multi || valid;
  return (
    <Sheet title={table ? t("tableH") : index !== null ? t("editIngTitle") : t("addIngTitle")} onClose={onClose}>
      {table ? (
        <>
          <ul className="pick-table" aria-label={t("tableH")}>
            {picked.map((p, i) => (
              <li key={p.name} className="pick-row">
                <span className="pick-row-name">
                  {p.look ? <FoodIcon look={p.look} size={32} /> : <span className="ing-icon-gap" aria-hidden="true" />}
                  <bdi>{p.name}</bdi>
                </span>
                <input
                  className="pick-qty"
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={t("qtyFor", { name: p.name })}
                  aria-invalid={p.quantity !== "" && !quantityOk(p.quantity) ? true : undefined}
                  value={p.quantity}
                  onChange={(e) => setPicked((cur) => cur.map((x, n) => (n === i ? { ...x, quantity: e.target.value } : x)))}
                />
                <select
                  className="pick-unit"
                  aria-label={t("unitFor", { name: p.name })}
                  value={p.unit}
                  onChange={(e) => setPicked((cur) => cur.map((x, n) => (n === i ? { ...x, unit: e.target.value } : x)))}
                >
                  <option value="">{t("noUnit")}</option>
                  {[...new Set([...UNIT_CHIPS[lang], ...(p.unit && !UNIT_CHIPS[lang].includes(p.unit) ? [p.unit] : [])])].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <button type="button" className="icon-btn" aria-label={t("removeFromPick", { name: p.name })} onClick={() => setPicked((cur) => cur.filter((_, n) => n !== i))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="actions">
            <button type="button" className="btn primary" disabled={!tableReady} onClick={addAll}>
              {t("addAll", { n: picked.length })}
            </button>
            <button type="button" className="btn ghost" onClick={() => setTable(false)}>
              {t("backToList")}
            </button>
          </div>
        </>
      ) : (
        <>
      <div className="field quick-input">
        <label htmlFor="quick-add">{t("quickAddLabel")}</label>
        <textarea
          id="quick-add"
          data-pilot="sheet-input"
          ref={input}
          dir="auto"
          rows={2}
          autoFocus
          placeholder={t("quickAddPh")}
          value={text}
          onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (/\r?\n/.test(pasted.trim())) {
              e.preventDefault();
              type(`${text}${text && !text.endsWith("\n") ? "\n" : ""}${pasted}`);
            }
          }}
        />
      </div>

      <div className="preview" aria-live="polite">
        {multi ? (
          <span className="muted">{t("pvMany", { n: parts.length })}</span>
        ) : text.trim() === "" ? (
          <span className="muted">{t("quickAddHint")}</span>
        ) : (
          <>
            <span className={quantityOk(f.quantity) ? "pv" : "pv missing"}>
              <small>{t("pvQty")}</small>
              <b dir="ltr">{quantityOk(f.quantity) ? formatQuantity(parseQuantity(f.quantity)!) : t("pvMissing")}</b>
            </span>
            {f.unit && (
              <span className="pv">
                <small>{t("pvUnit")}</small>
                <b>{f.unit}</b>
              </span>
            )}
            <span className={f.name.trim() ? "pv" : "pv missing"}>
              <small>{t("pvName")}</small>
              <span className="pv-name">
                {previewItem && <FoodIcon look={previewItem.look} size={22} />}
                <bdi>
                  <b>{f.name.trim() ? snap(f.name.trim()) : "—"}</b>
                </bdi>
              </span>
            </span>
          </>
        )}
      </div>

      {!multi && (
        <>
          {!typed && mem.often.length > 0 && index === null && (
            <div className="sheet-section">
              <h4>{t("oftenH")}</h4>
              <div className="tiles often-items" data-pilot="often" role="group" aria-label={t("oftenH")}>
                {mem.often.map((name) => {
                  const item = catalogItemFor(name);
                  const on = several ? picked.some((p) => memoryKey(p.name) === memoryKey(name)) : f.name === name;
                  return (
                    <button key={name} type="button" className="tile" aria-pressed={on} onClick={() => (several ? toggleSeveral(name, item?.look, item?.unit ? UNIT_CHIPS[lang][CANON_UNITS.indexOf(item.unit)] : "") : pickName(name))}>
                      {item ? <FoodIcon look={item.look} size={44} /> : <span className="ing-icon-gap tile-gap" aria-hidden="true" />}
                      <span className="tile-name">
                        <bdi>{name}</bdi>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="sheet-section">
            <div className="sheet-section-head">
              <h4>{t("catalogH")}</h4>
              {index === null && (
                <button type="button" className="chip" aria-pressed={several} onClick={() => { setSeveral((v) => !v); setPicked([]); }}>
                  {t("pickSeveral")}
                </button>
              )}
            </div>
            {!typed && (
              <div className="chip-row" role="group" aria-label={t("catalogH")}>
                {GROUPS.map((g) => (
                  <button key={g} type="button" className="chip" aria-pressed={g === group} onClick={() => setGroup(g)}>
                    {t(GROUP_LABEL[g])}
                  </button>
                ))}
              </div>
            )}
            <div className="tiles catalog-items" data-pilot="catalog" role="group" aria-label={typed ? t("catSearch") : t(GROUP_LABEL[group])}>
              {shown.map((item) => (
                <button key={`${item.group}:${item.en}`} type="button" className="tile" aria-pressed={several ? picked.some((p) => memoryKey(p.name) === memoryKey(catalogName(item, lang))) : f.name === catalogName(item, lang)} onClick={() => (several ? toggleSeveral(catalogName(item, lang), item.look, item.unit ? UNIT_CHIPS[lang][CANON_UNITS.indexOf(item.unit)] : "") : pick(item))}>
                  <FoodIcon look={item.look} size={44} />
                  <span className="tile-name">
                    <bdi>{catalogName(item, lang)}</bdi>
                    {typed && <small className="sub"> · {t(GROUP_LABEL[item.group])}</small>}
                  </span>
                </button>
              ))}
            </div>
            {typed && found.length === 0 && <p className="muted hint">{t("catNoMatch")}</p>}
            {several && (
              <div className="actions">
                <button type="button" className="btn primary" disabled={picked.length === 0} onClick={openTable}>
                  {t("setQuantities", { n: picked.length })}
                </button>
              </div>
            )}
          </div>
          {!several && lastTime && (
            <div className="sheet-section">
              <button type="button" className="chip suggested" data-pilot="last-time" onClick={() => set({ ...f, quantity: lastTime.quantity, unit: lastTime.unit })}>
                {t("lastTime", { text: [lastTime.quantity, lastTime.unit].filter(Boolean).join(" ") })}
              </button>
            </div>
          )}
          {!several && (
          <>
          <div className="sheet-section">
            <h4>{t("quickQtyH")}</h4>
            <div className="chip-row" data-pilot="qty-chips" role="group" aria-label={t("quickQtyH")}>
              {QUANTITY_CHIPS.map((q) => (
                <button key={q} type="button" className="chip num" aria-pressed={f.quantity === q} onClick={() => set({ ...f, quantity: f.quantity === q ? "" : q, unit: f.unit || (f.quantity === q ? "" : usual) })}>
                  <bdi dir="ltr">{formatQuantity(parseQuantity(q)!)}</bdi>
                </button>
              ))}
            </div>
          </div>
          <div className="sheet-section">
            <h4>{t("quickUnitH")}</h4>
            <div className="chip-row" role="group" aria-label={t("quickUnitH")}>
              {UNIT_CHIPS[lang].map((u) => (
                <button key={u} type="button" className={u === usual && !f.unit ? "chip suggested" : "chip"} aria-pressed={f.unit === u} onClick={() => set({ ...f, unit: f.unit === u ? "" : u, quantity: f.quantity || "1" })}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          {suggestions.length > 0 && (
            <div className="sheet-section">
              <h4>{t("sugH")}</h4>
              <div className="chip-row" role="group" aria-label={t("sugH")}>
                {suggestions.map((n) => (
                  <button key={n} type="button" className="chip" onClick={() => set({ ...f, name: n })}>
                    <bdi>{n}</bdi>
                  </button>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </>
      )}

      {added > 0 && (
        <p className="added-count" role="status">
          {added === 1 ? t("quickAddedOne") : t("quickAddedN", { n: added })}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn primary" data-pilot="sheet-add" disabled={!canAdd} onClick={add}>
          {index !== null ? t("updateBtn") : t("quickAddBtn")}
        </button>
        <button type="button" className="btn ghost" data-pilot="sheet-done" onClick={onClose}>
          {index !== null ? t("cancel") : t("done")}
        </button>
      </div>
        </>
      )}
    </Sheet>
  );
}

import { useMemo, useRef, useState } from "react";
import { normalizeArabic } from "../../../lib/arabic";
import { CATALOG, catalogName, GROUPS, searchCatalog, type CatalogGroup, type CatalogItem, type CatalogUnit } from "../../../lib/catalog";
import { parseIngredientLine, splitLines, type IngredientFields } from "../../../lib/ingredient-line";
import { normalizeName } from "../../../lib/ingredients";
import { formatQuantity, parseQuantity } from "../../../lib/quantity";
import type { Lang } from "../i18n";
import { useI18n } from "../i18n";
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
  onAdd,
  onReplace,
  onClose,
}: {
  rows: IngRow[];
  /** Which row is being edited, or null to add new ones. */
  index: number | null;
  knownNames: string[];
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

  const known = useMemo(() => new Map(knownNames.map((n) => [normalizeName(n), n])), [knownNames]);
  const snap = (name: string) => known.get(normalizeName(name)) ?? name;
  const valid = f.name.trim() !== "" && quantityOk(f.quantity);
  const multi = /\r?\n/.test(text.trim());

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

  function add() {
    if (multi) {
      const parsed = splitLines(text).map(parseIngredientLine).filter((r) => r.name || r.quantity || r.unit).map((r) => ({ ...r, name: snap(r.name) }));
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
    <Sheet title={index !== null ? t("editIngTitle") : t("addIngTitle")} onClose={onClose}>
      <div className="field quick-input">
        <label htmlFor="quick-add">{t("quickAddLabel")}</label>
        <textarea
          id="quick-add"
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
          <span className="muted">{t("pvMany", { n: splitLines(text).length })}</span>
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
              <bdi>
                <b>{f.name.trim() ? snap(f.name.trim()) : "—"}</b>
              </bdi>
            </span>
          </>
        )}
      </div>

      {!multi && (
        <>
          <div className="sheet-section">
            <h4>{t("catalogH")}</h4>
            {!typed && (
              <div className="chip-row" role="group" aria-label={t("catalogH")}>
                {GROUPS.map((g) => (
                  <button key={g} type="button" className="chip" aria-pressed={g === group} onClick={() => setGroup(g)}>
                    {t(GROUP_LABEL[g])}
                  </button>
                ))}
              </div>
            )}
            <div className="chips catalog-items" role="group" aria-label={typed ? t("catSearch") : t(GROUP_LABEL[group])}>
              {shown.map((item) => (
                <button key={`${item.group}:${item.en}`} type="button" className="chip" aria-pressed={f.name === catalogName(item, lang)} onClick={() => pick(item)}>
                  <bdi>{catalogName(item, lang)}</bdi>
                  {typed && <small className="sub"> · {t(GROUP_LABEL[item.group])}</small>}
                </button>
              ))}
            </div>
            {typed && found.length === 0 && <p className="muted hint">{t("catNoMatch")}</p>}
          </div>
          <div className="sheet-section">
            <h4>{t("quickQtyH")}</h4>
            <div className="chip-row" role="group" aria-label={t("quickQtyH")}>
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

      {added > 0 && (
        <p className="added-count" role="status">
          {added === 1 ? t("quickAddedOne") : t("quickAddedN", { n: added })}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn primary" disabled={!canAdd} onClick={add}>
          {index !== null ? t("updateBtn") : t("quickAddBtn")}
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          {index !== null ? t("cancel") : t("done")}
        </button>
      </div>
    </Sheet>
  );
}

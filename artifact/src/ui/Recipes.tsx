import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeArabic } from "../../../lib/arabic";
import { parseIngredientLine, splitLines } from "../../../lib/ingredient-line";
import { normalizeName } from "../../../lib/ingredients";
import { formatQuantity } from "../../../lib/quantity";
import { isHttpUrl } from "../../../lib/url";
import { validateRecipe, type RecipeErrors, type RecipeFormValues } from "../forms";
import { unitSuggestions, useI18n } from "../i18n";
import type { Recipe } from "../model";
import { EXAMPLE_TAG, type Store } from "../store";
import { Arrow, ConfirmAction, Empty, FieldError, ItemLabel } from "./common";

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "edit"; id?: string };

// Search folds spelling variants, so typing ارز finds أرز and رز.
const fold = (s: string) => normalizeArabic(s).toLowerCase();

export function Recipes({ store, recipes, initialEditId }: { store: Store; recipes: Recipe[]; /** Open this food's edit form straight away (the This week tab jumps here to add ingredients). */ initialEditId?: string | null }) {
  // Ingredient names already used in any food, one per spelling-family (first written wins), for suggestions.
  const knownNames = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const r of recipes) for (const i of r.ingredients) if (i.name.trim()) byKey.set(normalizeName(i.name), byKey.get(normalizeName(i.name)) ?? i.name.trim());
    return [...byKey.values()];
  }, [recipes]);
  const [view, setView] = useState<View>(initialEditId ? { kind: "edit", id: initialEditId } : { kind: "list" });
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");

  if (view.kind === "edit") {
    const existing = recipes.find((r) => r.id === view.id);
    return (
      <RecipeForm
        key={view.id ?? "new"}
        initial={existing ? toForm(existing) : blankForm()}
        isNew={!existing}
        knownNames={knownNames}
        onCancel={() => setView(existing ? { kind: "detail", id: existing.id } : { kind: "list" })}
        onSave={async (recipe) => {
          const id = await store.saveRecipe({ ...recipe, id: existing?.id });
          if (id) setView({ kind: "detail", id }); // on failure stay on the form; the error banner says why
        }}
      />
    );
  }

  if (view.kind === "detail") {
    const recipe = recipes.find((r) => r.id === view.id);
    return (
      <RecipeDetail
        recipe={recipe}
        onBack={() => setView({ kind: "list" })}
        onEdit={() => recipe && setView({ kind: "edit", id: recipe.id })}
        onTag={(t) => {
          setTag(t);
          setView({ kind: "list" });
        }}
        onDelete={async () => {
          if (recipe) await store.deleteRecipe(recipe.id);
          setView({ kind: "list" });
        }}
      />
    );
  }

  return (
    <RecipeList
      recipes={recipes}
      q={q}
      tag={tag}
      setQ={setQ}
      setTag={setTag}
      onOpen={(id) => setView({ kind: "detail", id })}
      onNew={() => setView({ kind: "edit" })}
      onRemoveExamples={() => void store.removeExamples()}
    />
  );
}

function RecipeList(props: {
  recipes: Recipe[];
  q: string;
  tag: string;
  setQ: (v: string) => void;
  setTag: (v: string) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRemoveExamples: () => void;
}) {
  const { t, lang } = useI18n();
  const { recipes, q, tag } = props;
  const tags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, lang)), [recipes, lang]);
  const shown = useMemo(() => {
    const term = fold(q);
    return recipes
      .filter((r) => !tag || r.tags.includes(tag))
      .filter((r) => !term || fold(r.title).includes(term) || r.ingredients.some((i) => fold(i.name).includes(term)))
      .sort((a, b) => a.title.localeCompare(b.title, lang));
  }, [recipes, q, tag, lang]);
  const hasExamples = recipes.some((r) => r.tags.includes(EXAMPLE_TAG));

  return (
    <section aria-labelledby="recipes-h">
      <div className="page-head">
        <h2 id="recipes-h">{t("recipesH")}</h2>
        <button type="button" className="btn primary" onClick={props.onNew}>
          {t("newRecipe")}
        </button>
      </div>

      {hasExamples && (
        <div className="banner" role="note">
          <span>{t("examplesNote")}</span>
          <ConfirmAction label={t("removeExamples")} confirmLabel={t("removeExamplesConfirm")} onConfirm={props.onRemoveExamples} />
        </div>
      )}

      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="sr-only" htmlFor="recipe-search">
          {t("searchLabel")}
        </label>
        <input id="recipe-search" type="search" dir="auto" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => props.setQ(e.target.value)} />
      </form>

      {tags.length > 0 && (
        <div className="chips" role="group" aria-label={t("filterTags")}>
          {tags.map((tg) => (
            <button key={tg} type="button" className="chip" aria-pressed={tg === tag} onClick={() => props.setTag(tg === tag ? "" : tg)}>
              <bdi>{tg}</bdi>
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        recipes.length === 0 ? (
          <Empty title={t("noRecipes")}>{t("noRecipesHint")}</Empty>
        ) : (
          <Empty title={t("noMatch")}>
            <button type="button" className="link" onClick={() => { props.setQ(""); props.setTag(""); }}>
              {t("clearFilters")}
            </button>
          </Empty>
        )
      ) : (
        <ul className="rows">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className="row-btn" onClick={() => props.onOpen(r.id)}>
                <bdi className="row-title">{r.title}</bdi>
                <span className="muted num">
                  {r.ingredients.length === 0
                    ? t("rowMetaNoIng", { servings: r.servings })
                    : r.ingredients.length === 1
                      ? t("rowMetaOne", { servings: r.servings })
                      : t("rowMeta", { servings: r.servings, count: r.ingredients.length })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecipeDetail({
  recipe,
  onBack,
  onEdit,
  onTag,
  onDelete,
}: {
  recipe: Recipe | undefined;
  onBack: () => void;
  onEdit: () => void;
  onTag: (t: string) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  if (!recipe) {
    return (
      <Empty title={t("recipeGone")}>
        <button type="button" className="link" onClick={onBack}>
          {t("backToRecipesPlain")}
        </button>
      </Empty>
    );
  }
  return (
    <article>
      <button type="button" className="link" onClick={onBack}>
        <Arrow /> {t("backToRecipes")}
      </button>
      <div className="page-head">
        <h2 dir="auto">{recipe.title}</h2>
        <div className="actions">
          <button type="button" className="link" onClick={onEdit}>
            {t("edit")}
          </button>
          <ConfirmAction label={t("delete")} confirmLabel={t("deleteRecipeConfirm")} onConfirm={onDelete} />
        </div>
      </div>
      <p className="muted num">
        {t("servingsMeta", { servings: recipe.servings })}
        {recipe.sourceUrl && isHttpUrl(recipe.sourceUrl) && (
          <>
            {" · "}
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t("source")}
            </a>
          </>
        )}
      </p>
      {recipe.tags.length > 0 && (
        <div className="chips">
          {recipe.tags.map((tg) => (
            <button key={tg} type="button" className="chip" onClick={() => onTag(tg)}>
              <bdi>{tg}</bdi>
            </button>
          ))}
        </div>
      )}
      <h3>{t("ingredientsH")}</h3>
      {recipe.ingredients.length === 0 ? (
        <div className="empty-inline">
          <p className="muted">{t("noIngredientsYet")}</p>
          <button type="button" className="btn primary" onClick={onEdit}>
            {t("addIngredientsCta")}
          </button>
        </div>
      ) : (
        <ul className="ingredients">
          {recipe.ingredients.map((i, n) => (
            <li key={n} className="num">
              <ItemLabel quantity={i.quantity} unit={i.unit} name={i.name} />
            </li>
          ))}
        </ul>
      )}
      {recipe.instructions && (
        <>
          <h3>{t("instructionsH")}</h3>
          <p className="prose" dir="auto">
            {recipe.instructions}
          </p>
        </>
      )}
    </article>
  );
}

function blankForm(): RecipeFormValues {
  return { title: "", servings: "1", tags: "", sourceUrl: "", instructions: "", rows: [{ name: "", quantity: "", unit: "" }] };
}

function toForm(r: Recipe): RecipeFormValues {
  return {
    title: r.title,
    servings: String(r.servings),
    tags: r.tags.join(", "),
    sourceUrl: r.sourceUrl ?? "",
    instructions: r.instructions,
    // fractions round-trip exactly, so editing never erodes 1/3 into 0.33
    rows: r.ingredients.length
      ? r.ingredients.map((i) => ({ name: i.name, quantity: formatQuantity(i.quantity), unit: i.unit }))
      : [{ name: "", quantity: "", unit: "" }],
  };
}

function RecipeForm({
  initial,
  isNew,
  knownNames,
  onSave,
  onCancel,
}: {
  initial: RecipeFormValues;
  isNew: boolean;
  knownNames: string[];
  onSave: (r: Omit<Recipe, "id">) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, lang } = useI18n();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<RecipeErrors>({});
  const [saving, setSaving] = useState(false);
  const setRow = (n: number, patch: Partial<RecipeFormValues["rows"][number]>) =>
    setV((cur) => ({ ...cur, rows: cur.rows.map((r, i) => (i === n ? { ...r, ...patch } : r)) }));

  const [quick, setQuick] = useState("");
  const [added, setAdded] = useState(0);
  const focusQty = useRef<number | null>(null);
  const quickRef = useRef<HTMLTextAreaElement>(null);
  const isBlank = (r: RecipeFormValues["rows"][number]) => !r.name.trim() && !r.quantity.trim() && !r.unit.trim();

  // After rows are added, put the cursor where the next typing belongs (a row still missing its quantity).
  useEffect(() => {
    if (focusQty.current === null) return;
    document.getElementById(`ing-qty-${focusQty.current}`)?.focus();
    focusQty.current = null;
  });

  /** Turns typed or pasted lines into rows (taking the spelling of an ingredient already in another food). */
  function addLines(text: string) {
    const known = new Map(knownNames.map((n) => [normalizeName(n), n]));
    const parsed = splitLines(text).map(parseIngredientLine).filter((r) => r.name || r.quantity || r.unit).map((r) => ({ ...r, name: known.get(normalizeName(r.name)) ?? r.name }));
    if (parsed.length === 0) return;
    const kept = v.rows.filter((r) => !isBlank(r));
    setV({ ...v, rows: [...kept, ...parsed] });
    setQuick("");
    setAdded(parsed.length);
    const missing = parsed.findIndex((r) => !r.quantity);
    if (missing >= 0) focusQty.current = kept.length + missing;
    else quickRef.current?.focus();
  }

  function nameKey(e: React.KeyboardEvent, n: number) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault(); // Enter moves to the next ingredient; the Save button saves
    if (n < v.rows.length - 1) return void document.getElementById(`ing-qty-${n + 1}`)?.focus();
    if (isBlank(v.rows[n])) return;
    focusQty.current = n + 1; // the new row does not exist yet: focus it after it renders
    setV({ ...v, rows: [...v.rows, { name: "", quantity: "", unit: "" }] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateRecipe(v);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.recipe);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="stack">
      <h2>{isNew ? t("newRecipe") : t("editRecipe")}</h2>

      <div className="field">
        <label htmlFor="recipe-title">{t("fTitle")}</label>
        <input id="recipe-title" dir="auto" maxLength={120} value={v.title} aria-invalid={!!errors.title} aria-describedby="recipe-title-err" onChange={(e) => setV({ ...v, title: e.target.value })} />
        <FieldError id="recipe-title-err" msg={errors.title} />
      </div>

      <div className="two">
        <div className="field">
          <label htmlFor="recipe-servings">{t("fServings")}</label>
          <input id="recipe-servings" type="number" inputMode="numeric" min={1} max={100} value={v.servings} aria-describedby="recipe-servings-hint recipe-servings-err" onChange={(e) => setV({ ...v, servings: e.target.value })} />
          <p className="hint muted" id="recipe-servings-hint">{t("fServingsHint")}</p>
          <FieldError id="recipe-servings-err" msg={errors.servings} />
        </div>
        <div className="field">
          <label htmlFor="recipe-tags">{t("fTags")}</label>
          <input id="recipe-tags" dir="auto" placeholder={t("fTagsPh")} value={v.tags} aria-describedby="recipe-tags-err" onChange={(e) => setV({ ...v, tags: e.target.value })} />
          <FieldError id="recipe-tags-err" msg={errors.tags} />
        </div>
      </div>

      <fieldset className="ings">
        <legend>{t("ingredientsH")}</legend>
        <datalist id="units">{unitSuggestions(lang).map((u) => <option key={u} value={u} />)}</datalist>
        <datalist id="ing-names">{knownNames.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="quick-add">
          <label htmlFor="quick-add">{t("quickAddLabel")}</label>
          <div className="quick-row">
            <textarea
              id="quick-add"
              ref={quickRef}
              dir="auto"
              rows={2}
              autoFocus={!isNew && v.rows.every(isBlank)}
              placeholder={t("quickAddPh")}
              aria-describedby="quick-add-hint"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addLines(quick);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (/\r?\n/.test(text.trim())) {
                  e.preventDefault();
                  addLines(`${quick}\n${text}`);
                }
              }}
            />
            <button type="button" className="btn ghost" onClick={() => addLines(quick)}>
              {t("quickAddBtn")}
            </button>
          </div>
          <p id="quick-add-hint" className="hint muted">{t("quickAddHint")}</p>
          <p className="sr-only" role="status">{added > 0 ? (added === 1 ? t("quickAddedOne") : t("quickAddedN", { n: added })) : ""}</p>
        </div>
        {v.rows.map((r, n) => (
          <div key={n} className="ing-row">
            <input id={`ing-qty-${n}`} dir="ltr" aria-label={t("fQty", { n: n + 1 })} inputMode="decimal" placeholder={t("phQty")} value={r.quantity} onChange={(e) => setRow(n, { quantity: e.target.value })} />
            <input id={`ing-unit-${n}`} dir="auto" aria-label={t("fUnit", { n: n + 1 })} list="units" placeholder={t("phUnit")} value={r.unit} onChange={(e) => setRow(n, { unit: e.target.value })} />
            <input id={`ing-name-${n}`} dir="auto" aria-label={t("fIng", { n: n + 1 })} list="ing-names" placeholder={t("phIng")} value={r.name} onChange={(e) => setRow(n, { name: e.target.value })} onKeyDown={(e) => nameKey(e, n)} />
            <button type="button" className="icon-btn" aria-label={t("fRemoveIng", { n: n + 1 })} disabled={v.rows.length === 1} onClick={() => setV({ ...v, rows: v.rows.filter((_, i) => i !== n) })}>
              ✕
            </button>
          </div>
        ))}
        <FieldError id="recipe-ings-err" msg={errors.ingredients} />
        <button type="button" className="link" onClick={() => setV({ ...v, rows: [...v.rows, { name: "", quantity: "", unit: "" }] })}>
          {t("addIngredient")}
        </button>
      </fieldset>

      <div className="field">
        <label htmlFor="recipe-instructions">{t("fInstructions")}</label>
        <textarea id="recipe-instructions" dir="auto" rows={8} maxLength={20000} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor="recipe-source">{t("fSource")}</label>
        <input id="recipe-source" type="text" inputMode="url" dir="ltr" placeholder="https://" value={v.sourceUrl} aria-describedby="recipe-source-err" onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} />
        <FieldError id="recipe-source-err" msg={errors.sourceUrl} />
      </div>

      <div className="actions">
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? t("saving") : t("saveRecipe")}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

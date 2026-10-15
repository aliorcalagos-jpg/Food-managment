import { useMemo, useState } from "react";
import { normalizeArabic } from "../../../lib/arabic";
import { normalizeName } from "../../../lib/ingredients";
import { formatQuantity, parseQuantity } from "../../../lib/quantity";
import { isHttpUrl } from "../../../lib/url";
import { validateRecipe, type RecipeErrors, type RecipeFormValues } from "../forms";
import { useI18n } from "../i18n";
import type { Recipe } from "../model";
import { EXAMPLE_TAG, type Store } from "../store";
import { Arrow, ConfirmAction, Empty, FieldError, ItemLabel, Stepper, SwipeRow } from "./common";
import { catalogItemFor } from "../../../lib/catalog";
import { FoodIcon } from "./FoodIcon";
import { IngredientSheet, type IngRow } from "./IngredientSheet";

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "edit"; id?: string };

// Search folds spelling variants, so typing ارز finds أرز and رز.
const fold = (s: string) => normalizeArabic(s).toLowerCase();

export function Recipes({
  store,
  recipes,
  initialEditId,
  startNew,
}: {
  store: Store;
  recipes: Recipe[];
  /** Open this food's edit form straight away (the This week tab jumps here to add ingredients). */
  initialEditId?: string | null;
  /** Open an empty new-food form straight away. */
  startNew?: boolean;
}) {
  // Ingredient names already used in any food, one per spelling-family (first written wins), for suggestions.
  const knownNames = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const r of recipes) for (const i of r.ingredients) if (i.name.trim()) byKey.set(normalizeName(i.name), byKey.get(normalizeName(i.name)) ?? i.name.trim());
    return [...byKey.values()];
  }, [recipes]);
  const [view, setView] = useState<View>(initialEditId ? { kind: "edit", id: initialEditId } : startNew ? { kind: "edit" } : { kind: "list" });
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
        <h2 id="recipes-h" className="large-title">
          {t("recipesH")}
        </h2>
        <button type="button" className="add-btn" aria-label={t("newRecipe")} onClick={props.onNew}>
          <span aria-hidden="true">＋</span>
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
        <ul className="food-grid">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className={r.ingredients.length === 0 ? "food-card bare" : "food-card"} onClick={() => props.onOpen(r.id)}>
                <bdi className="food-card-title">{r.title}</bdi>
                <span className="food-card-meta num">
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
    <article className="stack">
      <button type="button" className="back" onClick={onBack}>
        <Arrow /> {t("backToRecipes")}
      </button>
      <div className="page-head">
        <h2 dir="auto">{recipe.title}</h2>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onEdit}>
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
        <div className="chips tags">
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
            <li key={n} className="num ing-row-detail">
              <IngIcon name={i.name} />
              <span>
                <ItemLabel quantity={i.quantity} unit={i.unit} name={i.name} />
              </span>
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

/** The little picture for an ingredient that is in the ready list (nothing for one typed by hand). */
function IngIcon({ name }: { name: string }) {
  const item = catalogItemFor(name);
  return item ? <FoodIcon look={item.look} size={30} /> : <span className="ing-icon-gap" aria-hidden="true" />;
}

function blankForm(): RecipeFormValues {
  return { title: "", servings: "1", tags: "", sourceUrl: "", instructions: "", rows: [] };
}

function toForm(r: Recipe): RecipeFormValues {
  return {
    title: r.title,
    servings: String(r.servings),
    tags: r.tags.join(", "),
    sourceUrl: r.sourceUrl ?? "",
    instructions: r.instructions,
    // fractions round-trip exactly, so editing never erodes 1/3 into 0.33
    rows: r.ingredients.map((i) => ({ name: i.name, quantity: formatQuantity(i.quantity), unit: i.unit })),
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
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<RecipeErrors>({});
  const [saving, setSaving] = useState(false);
  // null = closed; { index: null } = adding; { index: n } = editing ingredient n. A food with no ingredients opens ready to add.
  const [sheet, setSheet] = useState<{ index: number | null } | null>(!isNew && initial.rows.length === 0 ? { index: null } : null);
  const servings = Math.min(100, Math.max(1, Math.round(Number(v.servings) || 1)));

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
    <>
      <form onSubmit={submit} noValidate className="stack">
        <div className="modal-bar">
          <button type="button" className="bar-btn" onClick={onCancel}>
            {t("cancel")}
          </button>
          <h2>{isNew ? t("newRecipe") : t("editRecipe")}</h2>
          <button type="submit" className="bar-btn strong" disabled={saving}>
            {saving ? t("saving") : t("saveRecipe")}
          </button>
        </div>

        <div className="field">
          <label htmlFor="recipe-title">{t("fTitle")}</label>
          <input id="recipe-title" dir="auto" maxLength={120} value={v.title} aria-invalid={!!errors.title} aria-describedby="recipe-title-err" onChange={(e) => setV({ ...v, title: e.target.value })} />
          <FieldError id="recipe-title-err" msg={errors.title} />
        </div>

        <div className="field">
          <span className="label" id="recipe-servings-l">
            {t("fServings")}
          </span>
          <div>
            <Stepper value={servings} onChange={(n) => setV({ ...v, servings: String(n) })} label={t("fServings")} fewer={t("fewerServings")} more={t("moreServings")} count={t("servingsNow")} />
          </div>
          <p className="hint muted" id="recipe-servings-hint">
            {t("fServingsHint")}
          </p>
          <FieldError id="recipe-servings-err" msg={errors.servings} />
        </div>

        <fieldset className="ings">
          <legend>{t("ingredientsH")}</legend>
          {v.rows.length > 0 && (
            <ul className="ing-list">
              {v.rows.map((r, n) => {
                const q = parseQuantity(r.quantity);
                return (
                  <SwipeRow key={n} contentClass={q === null ? "ing-line bad" : "ing-line"} deleteLabel={t("delete")} onDelete={() => setV((cur) => ({ ...cur, rows: cur.rows.filter((_, i) => i !== n) }))}>
                    <button type="button" className="ing-line-btn num" onClick={() => setSheet({ index: n })}>
                      <IngIcon name={r.name} />
                      {q === null ? (
                        <span className="ing-text">
                          <bdi>{r.name}</bdi>
                          <small>{t("needsQty")}</small>
                        </span>
                      ) : (
                        <span>
                          <ItemLabel quantity={q} unit={r.unit} name={r.name} />
                        </span>
                      )}
                    </button>
                    <button type="button" className="icon-btn row-remove" aria-label={t("fRemoveIng", { n: n + 1 })} onClick={() => setV((cur) => ({ ...cur, rows: cur.rows.filter((_, i) => i !== n) }))}>
                      ✕
                    </button>
                  </SwipeRow>
                );
              })}
            </ul>
          )}
          <FieldError id="recipe-ings-err" msg={errors.ingredients} />
          <button type="button" className="btn ghost add-ing block" onClick={() => setSheet({ index: null })}>
            <span aria-hidden="true">＋ </span>
            {t("addIngredient")}
          </button>
        </fieldset>

        <details className="more">
          <summary>{t("moreDetails")}</summary>
          <div className="stack">
            <div className="field">
              <label htmlFor="recipe-tags">{t("fTags")}</label>
              <input id="recipe-tags" dir="auto" placeholder={t("fTagsPh")} value={v.tags} aria-describedby="recipe-tags-err" onChange={(e) => setV({ ...v, tags: e.target.value })} />
              <FieldError id="recipe-tags-err" msg={errors.tags} />
            </div>
            <div className="field">
              <label htmlFor="recipe-instructions">{t("fInstructions")}</label>
              <textarea id="recipe-instructions" dir="auto" rows={6} maxLength={20000} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="recipe-source">{t("fSource")}</label>
              <input id="recipe-source" type="text" inputMode="url" dir="ltr" placeholder="https://" value={v.sourceUrl} aria-describedby="recipe-source-err" onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} />
              <FieldError id="recipe-source-err" msg={errors.sourceUrl} />
            </div>
          </div>
        </details>
      </form>

      {sheet && (
        <IngredientSheet
          rows={v.rows}
          index={sheet.index}
          knownNames={knownNames}
          onAdd={(added: IngRow[]) => setV((cur) => ({ ...cur, rows: [...cur.rows, ...added] }))}
          onReplace={(i, row) => setV((cur) => ({ ...cur, rows: cur.rows.map((r, n) => (n === i ? row : r)) }))}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

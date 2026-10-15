import { useMemo, useState } from "react";
import { formatQuantity } from "../../../lib/quantity";
import { isHttpUrl } from "../../../lib/url";
import { validateRecipe, type RecipeErrors, type RecipeFormValues } from "../forms";
import type { Recipe } from "../model";
import { EXAMPLE_TAG, type Store } from "../store";
import { ConfirmAction, Empty, FieldError } from "./common";

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "edit"; id?: string };

export function Recipes({ store, recipes }: { store: Store; recipes: Recipe[] }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");

  if (view.kind === "edit") {
    const existing = recipes.find((r) => r.id === view.id);
    return (
      <RecipeForm
        key={view.id ?? "new"}
        initial={existing ? toForm(existing) : blankForm()}
        title={existing ? "Edit recipe" : "New recipe"}
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
  const { recipes, q, tag } = props;
  const tags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))].sort(), [recipes]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return recipes
      .filter((r) => !tag || r.tags.includes(tag))
      .filter((r) => !term || r.title.toLowerCase().includes(term) || r.ingredients.some((i) => i.name.toLowerCase().includes(term)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [recipes, q, tag]);
  const hasExamples = recipes.some((r) => r.tags.includes(EXAMPLE_TAG));

  return (
    <section aria-labelledby="recipes-h">
      <div className="page-head">
        <h2 id="recipes-h">Recipes</h2>
        <button type="button" className="btn primary" onClick={props.onNew}>
          New recipe
        </button>
      </div>

      {hasExamples && (
        <div className="banner" role="note">
          <span>These are example recipes to show how the planner works.</span>
          <ConfirmAction label="Remove examples" confirmLabel="Remove all examples" onConfirm={props.onRemoveExamples} />
        </div>
      )}

      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="sr-only" htmlFor="recipe-search">
          Search recipes
        </label>
        <input id="recipe-search" type="search" placeholder="Search by title or ingredient" value={q} onChange={(e) => props.setQ(e.target.value)} />
      </form>

      {tags.length > 0 && (
        <div className="chips" role="group" aria-label="Filter by tag">
          {tags.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={t === tag} onClick={() => props.setTag(t === tag ? "" : t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        recipes.length === 0 ? (
          <Empty title="No recipes yet">Add the first one, then plan your week around it.</Empty>
        ) : (
          <Empty title="No recipes match">
            <button type="button" className="link" onClick={() => { props.setQ(""); props.setTag(""); }}>
              Clear filters
            </button>
          </Empty>
        )
      ) : (
        <ul className="rows">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className="row-btn" onClick={() => props.onOpen(r.id)}>
                <span className="row-title">{r.title}</span>
                <span className="muted num">
                  {r.servings} servings · {r.ingredients.length} ingredients
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
  if (!recipe) {
    return (
      <Empty title="That recipe isn't here any more">
        <button type="button" className="link" onClick={onBack}>
          Back to recipes
        </button>
      </Empty>
    );
  }
  return (
    <article>
      <button type="button" className="link" onClick={onBack}>
        ← All recipes
      </button>
      <div className="page-head">
        <h2>{recipe.title}</h2>
        <div className="actions">
          <button type="button" className="link" onClick={onEdit}>
            Edit
          </button>
          <ConfirmAction label="Delete" confirmLabel="Delete recipe and its planned meals" onConfirm={onDelete} />
        </div>
      </div>
      <p className="muted num">
        {recipe.servings} servings
        {recipe.sourceUrl && isHttpUrl(recipe.sourceUrl) && (
          <>
            {" · "}
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </>
        )}
      </p>
      {recipe.tags.length > 0 && (
        <div className="chips">
          {recipe.tags.map((t) => (
            <button key={t} type="button" className="chip" onClick={() => onTag(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      <h3>Ingredients</h3>
      <ul className="ingredients">
        {recipe.ingredients.map((i, n) => (
          <li key={n} className="num">
            {[formatQuantity(i.quantity), i.unit, i.name].filter(Boolean).join(" ")}
          </li>
        ))}
      </ul>
      {recipe.instructions && (
        <>
          <h3>Instructions</h3>
          <p className="prose">{recipe.instructions}</p>
        </>
      )}
    </article>
  );
}

function blankForm(): RecipeFormValues {
  return { title: "", servings: "4", tags: "", sourceUrl: "", instructions: "", rows: [{ name: "", quantity: "", unit: "" }] };
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

const UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb"];

function RecipeForm({
  initial,
  title,
  onSave,
  onCancel,
}: {
  initial: RecipeFormValues;
  title: string;
  onSave: (r: Omit<Recipe, "id">) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<RecipeErrors>({});
  const [saving, setSaving] = useState(false);
  const setRow = (n: number, patch: Partial<RecipeFormValues["rows"][number]>) =>
    setV((cur) => ({ ...cur, rows: cur.rows.map((r, i) => (i === n ? { ...r, ...patch } : r)) }));

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
      <h2>{title}</h2>

      <div className="field">
        <label htmlFor="recipe-title">Title</label>
        <input id="recipe-title" maxLength={120} value={v.title} aria-invalid={!!errors.title} aria-describedby="recipe-title-err" onChange={(e) => setV({ ...v, title: e.target.value })} />
        <FieldError id="recipe-title-err">{errors.title}</FieldError>
      </div>

      <div className="two">
        <div className="field">
          <label htmlFor="recipe-servings">Servings</label>
          <input id="recipe-servings" type="number" inputMode="numeric" min={1} max={100} value={v.servings} aria-describedby="recipe-servings-err" onChange={(e) => setV({ ...v, servings: e.target.value })} />
          <FieldError id="recipe-servings-err">{errors.servings}</FieldError>
        </div>
        <div className="field">
          <label htmlFor="recipe-tags">Tags (comma separated)</label>
          <input id="recipe-tags" placeholder="dinner, quick" value={v.tags} aria-describedby="recipe-tags-err" onChange={(e) => setV({ ...v, tags: e.target.value })} />
          <FieldError id="recipe-tags-err">{errors.tags}</FieldError>
        </div>
      </div>

      <fieldset className="ings">
        <legend>Ingredients</legend>
        <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        {v.rows.map((r, n) => (
          <div key={n} className="ing-row">
            <input id={`ing-qty-${n}`} aria-label={`Quantity ${n + 1}`} inputMode="decimal" placeholder="1/2" value={r.quantity} onChange={(e) => setRow(n, { quantity: e.target.value })} />
            <input id={`ing-unit-${n}`} aria-label={`Unit ${n + 1}`} list="units" placeholder="unit" value={r.unit} onChange={(e) => setRow(n, { unit: e.target.value })} />
            <input id={`ing-name-${n}`} aria-label={`Ingredient ${n + 1}`} placeholder="flour" value={r.name} onChange={(e) => setRow(n, { name: e.target.value })} />
            <button type="button" className="icon-btn" aria-label={`Remove ingredient ${n + 1}`} disabled={v.rows.length === 1} onClick={() => setV({ ...v, rows: v.rows.filter((_, i) => i !== n) })}>
              ✕
            </button>
          </div>
        ))}
        <FieldError id="recipe-ings-err">{errors.ingredients}</FieldError>
        <button type="button" className="link" onClick={() => setV({ ...v, rows: [...v.rows, { name: "", quantity: "", unit: "" }] })}>
          + Add ingredient
        </button>
      </fieldset>

      <div className="field">
        <label htmlFor="recipe-instructions">Instructions</label>
        <textarea id="recipe-instructions" rows={8} maxLength={20000} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor="recipe-source">Source link (optional)</label>
        <input id="recipe-source" type="text" inputMode="url" placeholder="https://" value={v.sourceUrl} aria-describedby="recipe-source-err" onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} />
        <FieldError id="recipe-source-err">{errors.sourceUrl}</FieldError>
      </div>

      <div className="actions">
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Saving…" : "Save recipe"}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

import { useState } from "react";
import { MEAL_TYPES, type MealTypeName } from "../../../lib/meals";
import { addDays, formatDay, formatWeekRange, parseISODate, startOfWeek, toISODate, weekDays } from "../../../lib/week";
import { useI18n } from "../i18n";
import { addMeal, newId, removeMeal, setMealServings, type PlanDay, type Recipe } from "../model";
import type { Store } from "../store";
import { todayISO } from "../today";
import { Arrow, Empty } from "./common";

export function Planner({ store, recipes, days }: { store: Store; recipes: Recipe[]; days: PlanDay[] }) {
  const { t, lang } = useI18n();
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(parseISODate(today)!));
  const thisWeek = toISODate(startOfWeek(parseISODate(today)!));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const byId = new Map(recipes.map((r) => [r.id, r]));

  return (
    <section aria-labelledby="planner-h">
      <div className="page-head">
        <h2 id="planner-h">{t("plannerH")}</h2>
        <nav aria-label={t("weekNav")} className="weeknav">
          <button type="button" className="link" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <Arrow /> {t("prev")}
          </button>
          <span className="week-range num" aria-live="polite">
            {formatWeekRange(weekStart, lang)}
          </span>
          <button type="button" className="link" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            {t("next")} <Arrow forward />
          </button>
          {toISODate(weekStart) !== thisWeek && (
            <button type="button" className="link" onClick={() => setWeekStart(startOfWeek(parseISODate(today)!))}>
              {t("thisWeek")}
            </button>
          )}
        </nav>
      </div>

      {recipes.length === 0 && <Empty title={t("needRecipe")}>{t("needRecipeHint")}</Empty>}

      <div className="days">
        {weekDays(weekStart).map((date) => {
          const iso = toISODate(date);
          const day = byDate.get(iso);
          return (
            <section key={iso} aria-label={formatDay(date, lang)} className="day">
              <h3 className="day-title">
                {formatDay(date, lang)}
                {iso === today && <span className="pill">{t("today")}</span>}
              </h3>
              {MEAL_TYPES.map((meal) => (
                <Slot
                  key={meal}
                  iso={iso}
                  dayLabel={formatDay(date, lang)}
                  meal={meal}
                  entries={(day?.entries ?? []).filter((e) => e.mealType === meal)}
                  recipes={recipes}
                  byId={byId}
                  store={store}
                />
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function Slot({
  iso,
  dayLabel,
  meal,
  entries,
  recipes,
  byId,
  store,
}: {
  iso: string;
  dayLabel: string;
  meal: MealTypeName;
  entries: PlanDay["entries"];
  recipes: Recipe[];
  byId: Map<string, Recipe>;
  store: Store;
}) {
  const { t, lang } = useI18n();
  const [recipeId, setRecipeId] = useState("");
  const [servings, setServings] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = recipeId || recipes[0]?.id || "";

  function add(e: React.FormEvent) {
    e.preventDefault();
    const recipe = byId.get(chosen);
    if (!recipe) return;
    const n = servings.trim() === "" ? recipe.servings : Number(servings);
    if (!Number.isInteger(n) || n < 1 || n > 100) return;
    void store.updateDay(iso, (day) => addMeal(day, iso, { id: newId(), mealType: meal, recipeId: recipe.id, servings: n }));
    setServings("");
    setOpen(false);
  }

  return (
    <div className="slot">
      <h4>{t(meal)}</h4>
      <div className="slot-body">
        {entries.map((e) => (
          <Entry key={e.id} entry={e} title={byId.get(e.recipeId)?.title ?? t("deletedRecipe")} meal={t(meal)} day={dayLabel} iso={iso} store={store} />
        ))}
        {recipes.length > 0 &&
          (open ? (
            <form onSubmit={add} className="add-meal">
              <label className="sr-only" htmlFor={`pick-${iso}-${meal}`}>
                {t("pickRecipe", { meal: t(meal), day: dayLabel })}
              </label>
              <select id={`pick-${iso}-${meal}`} value={chosen} onChange={(e) => setRecipeId(e.target.value)}>
                {[...recipes].sort((a, b) => a.title.localeCompare(b.title, lang)).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`srv-${iso}-${meal}`}>
                {t("servingsOptional")}
              </label>
              <input id={`srv-${iso}-${meal}`} type="number" inputMode="numeric" min={1} max={100} placeholder={t("phServings")} value={servings} onChange={(e) => setServings(e.target.value)} />
              <button type="submit" className="btn primary">
                {t("add")}
              </button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                {t("cancel")}
              </button>
            </form>
          ) : (
            <button type="button" className="link" onClick={() => setOpen(true)}>
              {t("addRecipe")}
            </button>
          ))}
      </div>
    </div>
  );
}

function Entry({ entry, title, meal, day, iso, store }: { entry: PlanDay["entries"][number]; title: string; meal: string; day: string; iso: string; store: Store }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(entry.servings));
  const [synced, setSynced] = useState(entry.servings);
  if (synced !== entry.servings) {
    // the stored value changed (another tab, or a save landed): show it
    setSynced(entry.servings);
    setDraft(String(entry.servings));
  }

  function commit() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1 || n > 100) return setDraft(String(entry.servings));
    if (n !== entry.servings) void store.updateDay(iso, (d) => (d ? setMealServings(d, entry.id, n) : { date: iso, entries: [] }));
  }

  return (
    <div className="entry">
      <bdi className="entry-title">{title}</bdi>
      <label className="sr-only" htmlFor={`s-${entry.id}`}>
        {t("servingsFor", { title })}
      </label>
      <input
        id={`s-${entry.id}`}
        className="servings"
        type="number"
        inputMode="numeric"
        min={1}
        max={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span className="muted">{t("servingsWord")}</span>
      <button
        type="button"
        className="link danger"
        aria-label={t("removeFrom", { title, meal, day })}
        onClick={() => void store.updateDay(iso, (d) => (d ? removeMeal(d, entry.id) : { date: iso, entries: [] }))}
      >
        {t("remove")}
      </button>
    </div>
  );
}

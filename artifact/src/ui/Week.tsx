import { useState } from "react";
import { groupItems } from "../../../lib/list-build";
import { addDays, formatWeekRange, parseISODate, startOfWeek, toISODate } from "../../../lib/week";
import { aisleLabel, useI18n } from "../i18n";
import { buildBuyList, setPick, type Recipe, type ShoppingList, type WeekPlan } from "../model";
import type { Store } from "../store";
import { todayISO } from "../today";
import { Arrow, Empty, ItemLabel } from "./common";

const MAX_SERVINGS = 100;

export function Week({
  store,
  recipes,
  weeks,
  lists,
  onEditRecipe,
  onOpenList,
}: {
  store: Store;
  recipes: Recipe[];
  weeks: WeekPlan[];
  lists: ShoppingList[];
  /** Jump to a food's edit form (to add its ingredients). */
  onEditRecipe: (id: string) => void;
  onOpenList: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const today = todayISO();
  const thisMonday = startOfWeek(parseISODate(today)!);
  const [monday, setMonday] = useState(thisMonday);
  const weekStart = toISODate(monday);
  const week = weeks.find((w) => w.weekStart === weekStart);
  const picks = week?.picks ?? [];
  const pickOf = new Map(picks.map((p) => [p.recipeId, p.servings]));
  const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title, lang));
  const buy = buildBuyList(picks, recipes);
  const started = week?.listId ? lists.find((l) => l.id === week.listId) : undefined;

  const choose = (recipe: Recipe, servings: number | null) => void store.updateWeek(weekStart, (w) => setPick(w, weekStart, recipe.id, servings));

  async function startShopping() {
    if (buy.items.length === 0) return;
    const range = { rangeStart: weekStart, rangeEnd: toISODate(addDays(monday, 6)) };
    const id = await store.startShopping(weekStart, {
      name: t("tripDefaultName", { date: today }),
      ...range,
      createdAt: new Date().toISOString(),
      shoppedOn: today,
      items: buy.items,
    });
    if (id) onOpenList(id);
  }

  return (
    <section aria-labelledby="week-h" className="stack">
      <div className="page-head">
        <h2 id="week-h">{t("weekH")}</h2>
        <nav aria-label={t("weekNav")} className="weeknav">
          <button type="button" className="link" onClick={() => setMonday(addDays(monday, -7))}>
            <Arrow /> {t("prev")}
          </button>
          <span className="week-range num" aria-live="polite">
            {formatWeekRange(monday, lang)}
          </span>
          <button type="button" className="link" onClick={() => setMonday(addDays(monday, 7))}>
            {t("next")} <Arrow forward />
          </button>
          {weekStart !== toISODate(thisMonday) && (
            <button type="button" className="link" onClick={() => setMonday(thisMonday)}>
              {t("thisWeek")}
            </button>
          )}
        </nav>
      </div>

      <div className="week-grid">
        <div className="stack">
          <h3 id="foods-h">{t("pickFoods")}</h3>
          {recipes.length === 0 ? (
            <Empty title={t("needFoods")}>{t("needFoodsHint")}</Empty>
          ) : (
            <ul className="rows food-list" aria-labelledby="foods-h">
              {sorted.map((r) => {
                const servings = pickOf.get(r.id);
                const on = servings !== undefined;
                const bare = r.ingredients.length === 0;
                return (
                  <li key={r.id} className={on ? "food on" : "food"}>
                    <button type="button" className="food-btn" aria-pressed={on} onClick={() => choose(r, on ? null : r.servings)}>
                      <span className="food-mark" aria-hidden="true">
                        {on ? "✓" : ""}
                      </span>
                      <bdi className="row-title">{r.title}</bdi>
                    </button>
                    {bare && (
                      <p className="food-note muted">
                        <span className="pill">{t("noIngredientsYet")}</span>{" "}
                        <button type="button" className="link" onClick={() => onEditRecipe(r.id)}>
                          {t("addIngredientsCta")}
                        </button>
                      </p>
                    )}
                    {on && (
                      <div className="food-servings">
                        <span className="stepper" role="group" aria-label={t("servingsFor", { title: r.title })}>
                          <button type="button" className="icon-btn" aria-label={t("fewer", { title: r.title })} disabled={servings <= 1} onClick={() => choose(r, servings - 1)}>
                            −
                          </button>
                          <output className="num stepper-n" aria-label={t("servingsCount", { title: r.title })}>
                            {servings}
                          </output>
                          <button type="button" className="icon-btn" aria-label={t("more", { title: r.title })} disabled={servings >= MAX_SERVINGS} onClick={() => choose(r, servings + 1)}>
                            +
                          </button>
                        </span>
                        <span className="muted">{t("servingsWord")}</span>
                        <span className="muted num">{t("recipeMakes", { n: r.servings })}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="card stack buy" aria-labelledby="buy-h">
          <div className="buy-head">
            <h3 id="buy-h">{t("buyH")}</h3>
            <span className="muted num" aria-live="polite">
              {buy.items.length === 1 ? t("buyCountOne") : t("buyCountN", { n: buy.items.length })}
            </span>
          </div>

          {buy.skipped.length > 0 && (
            <p className="banner" role="note">
              {t("noteSkipped", { names: buy.skipped.join(" · ") })}
            </p>
          )}

          {buy.items.length === 0 ? (
            <p className="muted">{picks.length === 0 ? t("buyEmpty") : t("buyNothingYet")}</p>
          ) : (
            groupItems(buy.items).map((g) => (
              <section key={g.category} aria-label={aisleLabel(lang, g.category)} className="aisle">
                <h4 className="aisle-title">{aisleLabel(lang, g.category)}</h4>
                <ul className="rows tight">
                  {g.items.map((i) => (
                    <li key={i.id} className="buy-item num">
                      <ItemLabel quantity={i.quantity} unit={i.unit} name={i.name} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {started && (
            <p className="banner" role="status">
              <span>{t("startedBanner")}</span>
              <button type="button" className="link" onClick={() => onOpenList(started.id)}>
                {t("openTheList")}
              </button>
            </p>
          )}
          <button type="button" className={started ? "btn ghost" : "btn primary"} disabled={buy.items.length === 0} onClick={() => void startShopping()}>
            {started ? t("startAnother") : t("startShopping")}
          </button>
        </aside>
      </div>
    </section>
  );
}

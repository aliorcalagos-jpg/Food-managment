import { useState } from "react";
import { groupItems } from "../../../lib/list-build";
import { addDays, formatWeekRange, parseISODate, startOfWeek, toISODate } from "../../../lib/week";
import { aisleLabel, useI18n } from "../i18n";
import { buildBuyList, setPick, type BuyList, type Recipe, type ShoppingList, type WeekPlan } from "../model";
import type { Store } from "../store";
import { todayISO } from "../today";
import { Arrow, Empty, ItemLabel, Sheet, Stepper, useWide } from "./common";

export function Week({
  store,
  recipes,
  weeks,
  lists,
  onEditRecipe,
  onOpenList,
  onNewFood,
}: {
  store: Store;
  recipes: Recipe[];
  weeks: WeekPlan[];
  lists: ShoppingList[];
  /** Jump to a food's edit form (to add its ingredients). */
  onEditRecipe: (id: string) => void;
  onOpenList: (id: string) => void;
  onNewFood: () => void;
}) {
  const { t, lang } = useI18n();
  const wide = useWide();
  const today = todayISO();
  const thisMonday = startOfWeek(parseISODate(today)!);
  const [monday, setMonday] = useState(thisMonday);
  const [sheet, setSheet] = useState(false);
  const weekStart = toISODate(monday);
  const week = weeks.find((w) => w.weekStart === weekStart);
  const picks = week?.picks ?? [];
  const pickOf = new Map(picks.map((p) => [p.recipeId, p.servings]));
  const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title, lang));
  const buy = buildBuyList(picks, recipes);
  const started = week?.listId ? lists.find((l) => l.id === week.listId) : undefined;
  const chosenCount = sorted.filter((r) => pickOf.has(r.id)).length;

  const choose = (recipe: Recipe, servings: number | null) => void store.updateWeek(weekStart, (w) => setPick(w, weekStart, recipe.id, servings));

  async function startShopping() {
    if (buy.items.length === 0) return;
    const id = await store.startShopping(weekStart, {
      name: t("tripDefaultName", { date: lang === "ar" ? `\u2066${today}\u2069` : today }),
      rangeStart: weekStart,
      rangeEnd: toISODate(addDays(monday, 6)),
      createdAt: new Date().toISOString(),
      shoppedOn: today,
      items: buy.items,
    });
    if (id) {
      setSheet(false);
      onOpenList(id);
    }
  }

  const startButton = (
    <button type="button" className={started && wide ? "btn ghost" : "btn primary"} disabled={buy.items.length === 0} onClick={() => void startShopping()}>
      {started ? t("startAnother") : t("startShopping")}
    </button>
  );
  const startedBanner = started && (
    <p className="banner" role="status">
      <span>{t("startedBanner")}</span>
      <button type="button" className="link" onClick={() => onOpenList(started.id)}>
        {t("openTheList")}
      </button>
    </p>
  );

  return (
    <section aria-labelledby="week-h" className="stack">
      <h2 id="week-h" className="large-title">
        {t("weekH")}
      </h2>
      <nav aria-label={t("weekNav")} className="week-bar">
        <button type="button" className="week-btn" aria-label={t("prev")} onClick={() => setMonday(addDays(monday, -7))}>
          <Arrow />
        </button>
        <div className="week-mid">
          <span className="week-range num" aria-live="polite">
            {formatWeekRange(monday, lang)}
          </span>
          {weekStart !== toISODate(thisMonday) && (
            <button type="button" className="week-now" onClick={() => setMonday(thisMonday)}>
              {t("thisWeek")}
            </button>
          )}
        </div>
        <button type="button" className="week-btn" aria-label={t("next")} onClick={() => setMonday(addDays(monday, 7))}>
          <Arrow forward />
        </button>
      </nav>

      <div className="week-grid">
        <div className="stack">
          <h3 id="foods-h">{t("pickFoods")}</h3>
          {recipes.length === 0 ? (
            <Empty title={t("needFoods")}>
              {t("needFoodsHint")}
              <span className="empty-inline">
                <button type="button" className="btn primary" onClick={onNewFood}>
                  {t("newRecipe")}
                </button>
              </span>
            </Empty>
          ) : (
            <ul className="picks" aria-labelledby="foods-h">
              {sorted.map((r) => {
                const servings = pickOf.get(r.id);
                const on = servings !== undefined;
                const bare = r.ingredients.length === 0;
                return (
                  <li key={r.id} className={on ? "pick on" : "pick"}>
                    <button type="button" className="pick-btn" aria-pressed={on} onClick={() => choose(r, on ? null : r.servings)}>
                      <span className="pick-check" aria-hidden="true">
                        ✓
                      </span>
                      <bdi>{r.title}</bdi>
                    </button>
                    {bare && (
                      <div className="pick-note">
                        <span className="pill">{t("noIngredientsYet")}</span>
                        <button type="button" className="link" onClick={() => onEditRecipe(r.id)}>
                          {t("addIngredientsCta")}
                        </button>
                      </div>
                    )}
                    {on && (
                      <div className="pick-foot">
                        <Stepper
                          value={servings}
                          onChange={(n) => choose(r, n)}
                          label={t("servingsFor", { title: r.title })}
                          fewer={t("fewer", { title: r.title })}
                          more={t("more", { title: r.title })}
                          count={t("servingsCount", { title: r.title })}
                        />
                        <span className="muted num">
                          {t("servingsWord")} · {t("recipeMakes", { n: r.servings })}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {wide && (
          <aside className="card buy" aria-labelledby="buy-h">
            <div className="buy-head">
              <h3 id="buy-h">{t("buyH")}</h3>
              <span className="muted num" aria-live="polite">
                {buy.items.length === 1 ? t("buyCountOne") : t("buyCountN", { n: buy.items.length })}
              </span>
            </div>
            <BuyBody buy={buy} chosen={picks.length} />
            {startedBanner}
            {startButton}
          </aside>
        )}
      </div>

      {!wide && recipes.length > 0 && (
        <>
          <div className="sticky-bar">
            <div className="sticky-in">
              <button type="button" className="bar-summary" disabled={chosenCount === 0} onClick={() => setSheet(true)}>
                <strong>{chosenCount === 0 ? t("barNone") : chosenCount === 1 ? t("barFoodOne") : t("barFoodN", { n: chosenCount })}</strong>
                <span aria-live="polite">
                  {buy.items.length === 1 ? t("buyCountOne") : t("buyCountN", { n: buy.items.length })}
                  {buy.items.length > 0 && <> · {t("barSee")}</>}
                </span>
              </button>
              {startButton}
            </div>
          </div>
          {sheet && (
            <Sheet title={t("buyH")} onClose={() => setSheet(false)}>
              <BuyBody buy={buy} chosen={picks.length} />
              {startedBanner}
              {startButton}
            </Sheet>
          )}
        </>
      )}
    </section>
  );
}

function BuyBody({ buy, chosen }: { buy: BuyList; chosen: number }) {
  const { t, lang } = useI18n();
  return (
    <>
      {buy.skipped.length > 0 && (
        <p className="banner" role="note">
          {t("noteSkipped", { names: buy.skipped.join(" · ") })}
        </p>
      )}
      {buy.items.length === 0 ? (
        <p className="muted">{chosen === 0 ? t("buyEmpty") : t("buyNothingYet")}</p>
      ) : (
        groupItems(buy.items).map((g) => (
          <section key={g.category} aria-label={aisleLabel(lang, g.category)} className="aisle">
            <h4 className="aisle-title">{aisleLabel(lang, g.category)}</h4>
            <ul className="rows">
              {g.items.map((i) => (
                <li key={i.id} className="buy-item num">
                  <ItemLabel quantity={i.quantity} unit={i.unit} name={i.name} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

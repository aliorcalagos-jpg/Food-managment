import { BackupCard, EffectsCard } from "./Backup";
import { useState } from "react";
import { currencySymbol, editableAmount, formatMoney, formatMoneyCompact, parseAmount, parseMoney, type Currency } from "../../../lib/money";
import { addDays, formatDay, formatWeekRange, localeFor, parseISODate, toISODate } from "../../../lib/week";
import { aisleLabel, useI18n, type Msg } from "../i18n";
import type { Settings, ShoppingList } from "../model";
import { useMoney } from "../money-context";
import { averageSpend, budgetStatus, history, weekOf, weekSummary, type BudgetState } from "../spending";
import type { Store } from "../store";
import { todayISO } from "../today";
import { Arrow, Empty, FieldError, Money } from "./common";

const STATUS_ICON: Record<Exclude<BudgetState, "none">, string> = { ok: "✓", warn: "!", over: "×" };

export function Expenses({
  store,
  lists,
  settings,
  onOpenList,
  onStartTrip,
}: {
  store: Store;
  lists: ShoppingList[];
  settings: Settings;
  onOpenList: (id: string) => void;
  onStartTrip: () => void;
}) {
  const { t, lang } = useI18n();
  const thisWeek = weekOf(todayISO())!;
  const [week, setWeek] = useState(thisWeek);
  const summary = weekSummary(lists, week);
  const status = budgetStatus(summary.spent, summary.planned, settings.weeklyBudget);
  const weeks = history(lists, week, 8);
  const anyPrices = lists.some((l) => l.items.some((i) => i.price !== null));
  const start = parseISODate(week)!;
  const move = (days: number) => setWeek(toISODate(addDays(start, days)));

  return (
    <section aria-labelledby="exp-h" className="stack">
      <h2 id="exp-h" className="large-title">
        {t("expensesH")}
      </h2>
      <nav aria-label={t("weekNavExpenses")} className="week-bar">
        <button type="button" className="week-btn" aria-label={t("prev")} onClick={() => move(-7)}>
          <Arrow />
        </button>
        <div className="week-mid">
          <span className="week-range num" aria-live="polite">
            {formatWeekRange(start, lang)}
          </span>
          {week !== thisWeek && (
            <button type="button" className="week-now" onClick={() => setWeek(thisWeek)}>
              {t("thisWeek")}
            </button>
          )}
        </div>
        <button type="button" className="week-btn" aria-label={t("next")} onClick={() => move(7)}>
          <Arrow forward />
        </button>
      </nav>

      {!anyPrices ? (
        <div className="card">
          <Empty title={t("noPricesTitle")}>{t("noPricesHint")}</Empty>
          <button type="button" className="btn primary" onClick={onStartTrip}>
            {t("startTrip")}
          </button>
        </div>
      ) : (
        <>
          <HeroCard summary={summary} status={status} budget={settings.weeklyBudget} weekLabel={formatWeekRange(start, lang)} />

          {summary.byAisle.length > 0 && (
            <section aria-labelledby="aisle-h" className="chart">
              <h3 id="aisle-h">{t("aisleH")}</h3>
              <AisleBars rows={summary.byAisle} />
            </section>
          )}

          <section aria-labelledby="hist-h" className="chart">
            <h3 id="hist-h">{t("historyH")}</h3>
            <HistoryChart weeks={weeks} budget={settings.weeklyBudget} selected={week} onSelect={setWeek} />
          </section>

          <section aria-labelledby="trips-h" className="chart">
            <h3 id="trips-h">{t("tripsH")}</h3>
            {summary.trips.length === 0 ? (
              <p className="muted">{t("noTripsWeek")}</p>
            ) : (
              <ul className="rows">
                {summary.trips.map((trip) => (
                  <li key={trip.listId}>
                    <button type="button" className="row-btn" onClick={() => onOpenList(trip.listId)}>
                      <bdi className="row-title">{trip.name}</bdi>
                      <span className="muted num">
                        <bdi>{formatDay(parseISODate(trip.shoppedOn)!, lang)}</bdi> · <Money kobo={trip.spent} />
                        {trip.planned > 0 && (
                          <>
                            {" · "}
                            {t("plannedTotal")} <Money kobo={trip.planned} />
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <SettingsForm store={store} settings={settings} />
      <BackupCard store={store} />
      <EffectsCard />
    </section>
  );
}

function HeroCard({
  summary,
  status,
  budget,
  weekLabel,
}: {
  summary: ReturnType<typeof weekSummary>;
  status: ReturnType<typeof budgetStatus>;
  budget: number | null;
  weekLabel: string;
}) {
  const { t } = useI18n();
  const { currency, rate } = useMoney();
  const spentPct = budget ? Math.min(100, (summary.spent / budget) * 100) : 0;
  const plannedPct = budget ? Math.min(100 - spentPct, (summary.planned / budget) * 100) : 0;
  const state = status.state;

  return (
    <div className="card hero-card" data-pilot="hero">
      <p className="muted">{t("spentOn", { range: weekLabel })}</p>
      <p className="hero num">
        <Money kobo={summary.spent} />
      </p>
      <p className="muted num">
        <Money kobo={summary.spent} onlyOther />
      </p>

      {state === "none" ? (
        <p className="muted">{t("noBudgetNote")}</p>
      ) : (
        <>
          <div
            className="meter"
            role="progressbar"
            aria-label={t("budgetLabel")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(100, status.percent))}
            aria-valuetext={t("meterText", { spent: formatMoney(summary.spent, currency, rate), budget: formatMoney(budget ?? 0, currency, rate) })}
          >
            <span className={`meter-fill ${state}`} style={{ width: `${spentPct}%` }} />
            <span className="meter-plan" style={{ width: `${plannedPct}%` }} />
          </div>
          <p className={`status ${state}`}>
            <span className="status-icon" aria-hidden="true">
              {STATUS_ICON[state]}
            </span>
            <strong>{state === "ok" ? t("statusOk") : state === "warn" ? t("statusWarn") : t("statusOver")}</strong>
          </p>
          {state === "warn" && status.projectedOver && summary.spent <= (budget ?? 0) && <p className="status-note">{t("statusProjected")}</p>}
          <dl className="facts num">
            <div>
              <dt>{t("budgetLabel")}</dt>
              <dd>
                <Money kobo={budget ?? 0} />
              </dd>
            </div>
            <div>
              <dt>{status.left < 0 ? t("overByLabel") : t("leftLabel")}</dt>
              <dd>
                <Money kobo={Math.abs(status.left)} />
              </dd>
            </div>
            {summary.planned > 0 && (
              <>
                <div>
                  <dt>{t("plannedNotBought")}</dt>
                  <dd>
                    <Money kobo={summary.planned} />
                  </dd>
                </div>
                <div>
                  <dt>{t("projectedLabel")}</dt>
                  <dd>
                    <Money kobo={summary.spent + summary.planned} />
                  </dd>
                </div>
              </>
            )}
          </dl>
        </>
      )}
      {state === "none" && summary.planned > 0 && (
        <p className="muted num">
          {t("plannedNotBought")}: <Money kobo={summary.planned} />
        </p>
      )}
    </div>
  );
}

function AisleBars({ rows }: { rows: { category: string; spent: number }[] }) {
  const { lang } = useI18n();
  const max = Math.max(...rows.map((r) => r.spent), 1);
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.category} className="bar-row">
          <span className="bar-label">{aisleLabel(lang, r.category)}</span>
          <span className="bar-track">
            <span className="bar-fill" data-spent={r.spent} style={{ width: `${(r.spent / max) * 100}%` }} />
          </span>
          <span className="bar-value num">
            <Money kobo={r.spent} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function HistoryChart({
  weeks,
  budget,
  selected,
  onSelect,
}: {
  weeks: { weekStart: string; spent: number; planned: number }[];
  budget: number | null;
  selected: string;
  onSelect: (w: string) => void;
}) {
  const { t, lang } = useI18n();
  const { currency, rate } = useMoney();
  const max = Math.max(budget ?? 0, ...weeks.map((w) => w.spent), 1);
  const avg = averageSpend(weeks);

  return (
    <>
      <div className="history" style={{ ["--budget" as string]: budget ? budget / max : 0 }}>
        <span className="axis-max num">
          <bdi dir="ltr">{formatMoneyCompact(max, currency, rate)}</bdi>
        </span>
        {budget ? (
          <span className="budget-line">
            <span className="budget-tag num">
              {t("budgetLine")} <bdi dir="ltr">{formatMoneyCompact(budget, currency, rate)}</bdi>
            </span>
          </span>
        ) : null}
        {weeks.map((w, k) => {
          const d = parseISODate(w.weekStart)!;
          const prev = k > 0 ? parseISODate(weeks[k - 1].weekStart)! : null;
          // the day number, plus the month name only where the month changes (a full date under every bar collides)
          const month = !prev || prev.getUTCMonth() !== d.getUTCMonth() ? d.toLocaleDateString(localeFor(lang), { month: "short", timeZone: "UTC" }) : "";
          const rangeText = formatWeekRange(parseISODate(w.weekStart)!, lang);
          const isSel = w.weekStart === selected;
          return (
            <button
              key={w.weekStart}
              type="button"
              className="col"
              data-spent={w.spent}
              aria-pressed={isSel}
              title={t("weekBar", { range: rangeText, spent: formatMoneyCompact(w.spent, currency, rate) })}
              aria-label={t("weekBar", { range: rangeText, spent: formatMoneyCompact(w.spent, currency, rate) })}
              onClick={() => onSelect(w.weekStart)}
            >
              <span className="col-value num">{isSel && w.spent > 0 ? <bdi dir="ltr">{formatMoneyCompact(w.spent, currency, rate)}</bdi> : ""}</span>
              <span className="col-plot">
                <span className={isSel ? "col-bar selected" : "col-bar"} style={{ height: `${(w.spent / max) * 100}%` }} />
              </span>
              <span className="col-label num">
                <bdi>{d.getUTCDate()}</bdi>
                {month && <small><bdi>{month}</bdi></small>}
              </span>
            </button>
          );
        })}
      </div>
      {avg !== null && (
        <p className="muted num">
          {t("avgPerWeek")}: <Money kobo={avg} withOther />
        </p>
      )}
      <details className="numbers">
        <summary>{t("showNumbers")}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("colWeek")}</th>
              <th scope="col">{t("colSpent")}</th>
              <th scope="col">{t("colPlanned")}</th>
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map((w) => (
              <tr key={w.weekStart}>
                <th scope="row">{formatWeekRange(parseISODate(w.weekStart)!, lang)}</th>
                <td className="num">
                  <Money kobo={w.spent} />
                </td>
                <td className="num">{w.planned ? <Money kobo={w.planned} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

function SettingsForm({ store, settings }: { store: Store; settings: Settings }) {
  const { t } = useI18n();
  const { currency, rate } = useMoney();
  const [budgetText, setBudgetText] = useState(settings.weeklyBudget === null ? "" : editableAmount(settings.weeklyBudget, currency, rate));
  const [rateText, setRateText] = useState(String(settings.rate));
  const [errors, setErrors] = useState<{ budget?: Msg; rate?: Msg }>({});
  const [savedNote, setSavedNote] = useState(false);
  // Only what was actually edited is written. The budget box shows a rounded figure after a currency switch
  // ("$7.25" for ₦10,000), so saving untouched text would quietly change the stored budget.
  const [edited, setEdited] = useState({ budget: false, rate: false });
  // Open by default only while there is no budget yet, and decided once: a controlled `open` would collapse
  // the panel (and the "Saved" note with it) the moment a budget is saved.
  const [startOpen] = useState(settings.weeklyBudget === null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next: { budget?: Msg; rate?: Msg } = {};
    let newRate = settings.rate;
    if (edited.rate) {
      const parsed = parseAmount(rateText);
      if (parsed === null || parsed <= 0) next.rate = { key: "errRate" };
      else newRate = parsed;
    }
    let weeklyBudget = settings.weeklyBudget;
    if (edited.budget) {
      if (budgetText.trim() === "") weeklyBudget = null;
      else {
        weeklyBudget = parseMoney(budgetText, currency, newRate);
        if (weeklyBudget === null) next.budget = { key: "errAmount" };
      }
    }
    setErrors(next);
    if (next.budget || next.rate) return setSavedNote(false);
    await store.updateSettings({ rate: newRate, weeklyBudget });
    setEdited({ budget: false, rate: false });
    setSavedNote(true);
  }

  const switchCurrency = (c: Currency) => {
    // keep the same budget amount on screen in the new currency
    if (c === currency) return;
    setSavedNote(false);
    setEdited((e) => ({ ...e, budget: false }));
    setBudgetText(settings.weeklyBudget === null ? "" : editableAmount(settings.weeklyBudget, c, settings.rate));
    void store.updateSettings({ currency: c });
  };

  return (
    <details className="card settings" open={startOpen}>
      <summary data-pilot="settings-summary">
        <h3 style={{ display: "inline" }}>{t("settingsH")}</h3>
      </summary>
      <div className="stack">
        <div className="field">
          <span className="label">{t("fCurrency")}</span>
          <div className="segmented" data-pilot="currency" role="group" aria-label={t("fCurrency")}>
            {(["NGN", "USD"] as const).map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={currency === c} onClick={() => switchCurrency(c)}>
                {c === "NGN" ? t("curNGN") : t("curUSD")}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={save} className="stack" noValidate>
          <div className="field">
            <label htmlFor="set-budget">
              {t("fBudget")} ({currencySymbol(currency)})
            </label>
            <input id="set-budget" data-pilot="budget-input" inputMode="decimal" dir="ltr" placeholder={currency === "NGN" ? "50000" : "40"} value={budgetText} aria-describedby="set-budget-err" onChange={(e) => { setBudgetText(e.target.value); setEdited((x) => ({ ...x, budget: true })); }} />
            <FieldError id="set-budget-err" msg={errors.budget} />
          </div>
          <div className="field">
            <label htmlFor="set-rate">{t("fRate")}</label>
            <input id="set-rate" inputMode="decimal" dir="ltr" value={rateText} aria-describedby="set-rate-err" onChange={(e) => { setRateText(e.target.value); setEdited((x) => ({ ...x, rate: true })); }} />
            <p className="muted small">{t("rateNote")}</p>
            <FieldError id="set-rate-err" msg={errors.rate} />
          </div>
          <div className="actions">
            <button type="submit" className="btn primary">
              {t("save")}
            </button>
            {settings.weeklyBudget !== null && (
              <button
                type="button"
                className="link danger"
                onClick={() => {
                  setBudgetText("");
                  setEdited((x) => ({ ...x, budget: false }));
                  void store.updateSettings({ weeklyBudget: null });
                }}
              >
                {t("clearBudget")}
              </button>
            )}
            {savedNote && <span role="status" className="muted">{t("saved")}</span>}
          </div>
        </form>
      </div>
    </details>
  );
}


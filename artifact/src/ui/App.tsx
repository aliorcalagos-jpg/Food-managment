import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, I18nContext, makeI18n, type Lang } from "../i18n";
import { MoneyContext } from "../money-context";
import { addDays, formatRange, parseISODate } from "../../../lib/week";
import { todayISO } from "../today";
import { useStore, type Store } from "../store";
import { Empty, Icon } from "./common";
import { Expenses } from "./Expenses";
import { Lists } from "./Lists";
import { Pilot } from "./Pilot";
import { Recipes } from "./Recipes";
import { Week } from "./Week";

const TABS = [
  { id: "week", label: "tabWeek", icon: "week" },
  { id: "recipes", label: "tabRecipes", icon: "foods" },
  { id: "lists", label: "tabLists", icon: "shopping" },
  { id: "expenses", label: "tabExpenses", icon: "spending" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const TAB_KEY = "meal-planner:tab";
const LANG_KEY = "meal-planner:lang";
const PILOT_KEY = "meal-planner:pilot-on";

// A remembered tab or language is only a convenience: storage can be blocked or empty.
function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (TABS.some((x) => x.id === t)) return t as Tab;
  } catch {
    /* storage unavailable */
  }
  return "week";
}
function readPilotOn(): boolean {
  try {
    return localStorage.getItem(PILOT_KEY) !== "off";
  } catch {
    return true;
  }
}
function readLocalLang(): Lang | null {
  try {
    const l = localStorage.getItem(LANG_KEY);
    return l === "en" || l === "ar" ? l : null;
  } catch {
    return null;
  }
}

export function App({ store }: { store: Store }) {
  const state = useStore(store);
  const [tab, setTab] = useState<Tab>(readTab);
  const [scrolled, setScrolled] = useState(false);
  const [pilotOn, setPilotOn] = useState(readPilotOn);
  const [localLang, setLocalLang] = useState<Lang | null>(readLocalLang);
  // The saved choice (shared by every device) wins, then this device's, then the default.
  const lang: Lang = state.settings.lang ?? localLang ?? DEFAULT_LANG;
  const i18n = useMemo(() => makeI18n(lang), [lang]);
  const { t, dir } = i18n;

  // the top bar gets its hairline once the large title has scrolled under it
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // the week's shopping list is named in the current language
  useEffect(() => {
    store.setListNamer((weekStart) => {
      const a = parseISODate(weekStart);
      return a ? makeI18n(lang).t("weekListName", { range: formatRange(a, addDays(a, 6), lang) }) : weekStart;
    });
  }, [store, lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  // Jumping from a shopping trip on the Expenses tab opens that list; the key remounts the Lists tab on it.
  const [open, setOpen] = useState<{ id: string | null; key: number }>({ id: null, key: 0 });
  const choose = (next: Tab) => {
    setTab(next);
    // a screen opened by a jump (a list, a food's form) is only opened once: coming back later shows the index
    if (next !== "lists") setOpen((o) => (o.id ? { ...o, id: null } : o));
    if (next !== "recipes") setEdit((e) => (e.id || e.isNew ? { ...e, id: null, isNew: false } : e));
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };
  const switchLang = () => {
    const next: Lang = lang === "ar" ? "en" : "ar";
    setLocalLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* storage unavailable */
    }
    void store.updateSettings({ lang: next });
  };

  const openList = (id: string) => {
    setOpen((o) => ({ id, key: o.key + 1 }));
    choose("lists");
  };
  // Jumping from a food with no ingredients on This week opens its edit form.
  const [edit, setEdit] = useState<{ id: string | null; key: number; isNew?: boolean }>({ id: null, key: 0 });
  const editRecipe = (id: string) => {
    setEdit((e) => ({ id, key: e.key + 1 }));
    choose("recipes");
  };
  // The Android app asks this on the back button: close what is open and say so, or let the app exit.
  useEffect(() => {
    const w = window as unknown as { __back?: () => boolean };
    const click = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      el?.click();
      return !!el;
    };
    w.__back = () =>
      click('.action-overlay .action-btn.cancel') ||
      click(".sheet-overlay .sheet-close") ||
      click('[data-pilot-ui="card"] .sheet-close') ||
      click(".modal-bar .bar-btn:not(.strong)") ||
      click("button.back") ||
      (tab !== "week" ? (choose("week"), true) : false);
    return () => {
      delete w.__back;
    };
  });

  const newFood = () => {
    setEdit((e) => ({ id: null, key: e.key + 1, isNew: true }));
    choose("recipes");
  };
  const startTrip = async () => {
    const date = todayISO();
    const id = await store.createList({
      name: i18n.t("tripDefaultName", { date: lang === "ar" ? `\u2066${date}\u2069` : date }),
      rangeStart: null,
      rangeEnd: null,
      createdAt: new Date().toISOString(),
      shoppedOn: date,
      items: [],
    });
    if (id) openList(id);
  };

  return (
    <I18nContext.Provider value={i18n}>
     <MoneyContext.Provider value={{ currency: state.settings.currency, rate: state.settings.rate }}>
      <div className="app" dir={dir} lang={lang}>
        <header className={scrolled ? "top scrolled" : "top"}>
          <div className="top-row">
            {/* shows the language you would switch to, written in that language */}
            <button type="button" className="lang-switch" lang={lang === "ar" ? "en" : "ar"} aria-label={t("language")} onClick={switchLang}>
              {t("switchTo")}
            </button>
            <h1 className="brand">{t("brand")}</h1>
            <button
              type="button"
              className="lang-switch pilot-toggle"
              aria-pressed={pilotOn}
              aria-label={t("pilotShowHide")}
              onClick={() => {
                const next = !pilotOn;
                setPilotOn(next);
                try {
                  localStorage.setItem(PILOT_KEY, next ? "on" : "off");
                } catch {
                  /* storage unavailable */
                }
              }}
            >
              {t("pilotName")}
            </button>
          </div>
        </header>

        {state.error && state.status !== "unavailable" && (
          <div className="banner error" role="alert">
            <span>{t("saveFailed", { msg: state.error })}</span>
            <button type="button" className="link" onClick={store.dismissError}>
              {t("dismiss")}
            </button>
          </div>
        )}

        <main className="main">
          {state.status === "loading" && <Empty title={t("loading")} />}
          {state.status === "unavailable" && <Empty title={t("unavailableTitle")}>{t("unavailableBody")}</Empty>}
          {state.status === "ready" && tab === "expenses" && (
            <Expenses store={store} lists={state.lists} settings={state.settings} onOpenList={openList} onStartTrip={() => void startTrip()} />
          )}
          {state.status === "ready" && tab === "week" && (
            <Week store={store} recipes={state.recipes} weeks={state.weeks} lists={state.lists} onEditRecipe={editRecipe} onOpenList={openList} onNewFood={newFood} />
          )}
          {state.status === "ready" && tab === "recipes" && <Recipes key={edit.key} store={store} recipes={state.recipes} initialEditId={edit.id} startNew={edit.isNew} />}
          {state.status === "ready" && tab === "lists" && <Lists key={open.key} store={store} lists={state.lists} recipes={state.recipes} weeks={state.weeks} initialListId={open.id} />}
        </main>

        {state.status === "ready" && pilotOn && <Pilot state={state} tab={tab} go={choose} />}

        <nav className="bottom-nav" aria-label={t("sections")}>
          <div className="bottom-nav-in">
            {TABS.map((x) => (
              <button key={x.id} type="button" className="nav-btn" data-pilot={`nav-${x.id}`} aria-current={tab === x.id ? "page" : undefined} onClick={() => choose(x.id)}>
                <span className="nav-ico">
                  <Icon name={x.icon} />
                </span>
                {t(x.label)}
              </button>
            ))}
          </div>
        </nav>
      </div>
     </MoneyContext.Provider>
    </I18nContext.Provider>
  );
}

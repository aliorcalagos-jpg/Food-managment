import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, I18nContext, makeI18n, type Lang } from "../i18n";
import { useStore, type Store } from "../store";
import { Empty } from "./common";
import { Lists } from "./Lists";
import { Planner } from "./Planner";
import { Recipes } from "./Recipes";

const TABS = [
  { id: "recipes", label: "tabRecipes" },
  { id: "planner", label: "tabPlanner" },
  { id: "lists", label: "tabLists" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const TAB_KEY = "meal-planner:tab";
const LANG_KEY = "meal-planner:lang";

// A remembered tab or language is only a convenience: storage can be blocked or empty.
function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (TABS.some((x) => x.id === t)) return t as Tab;
  } catch {
    /* storage unavailable */
  }
  return "recipes";
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
  const [localLang, setLocalLang] = useState<Lang | null>(readLocalLang);

  // The saved choice (shared by every device) wins, then this device's, then the default.
  const lang: Lang = state.lang ?? localLang ?? DEFAULT_LANG;
  const i18n = useMemo(() => makeI18n(lang), [lang]);
  const { t, dir } = i18n;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const choose = (next: Tab) => {
    setTab(next);
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
    void store.setLang(next);
  };

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app" dir={dir} lang={lang}>
        <header className="top">
          <div className="top-row">
            <h1 className="brand">{t("brand")}</h1>
            {/* shows the language you would switch to, written in that language */}
            <button type="button" className="link lang-switch" lang={lang === "ar" ? "en" : "ar"} aria-label={t("language")} onClick={switchLang}>
              {t("switchTo")}
            </button>
          </div>
          <nav className="tabs" aria-label={t("sections")}>
            {TABS.map((x) => (
              <button key={x.id} type="button" className="tab" aria-current={tab === x.id ? "page" : undefined} onClick={() => choose(x.id)}>
                {t(x.label)}
              </button>
            ))}
          </nav>
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
          {state.status === "ready" && tab === "recipes" && <Recipes store={store} recipes={state.recipes} />}
          {state.status === "ready" && tab === "planner" && <Planner store={store} recipes={state.recipes} days={state.days} />}
          {state.status === "ready" && tab === "lists" && <Lists store={store} lists={state.lists} recipes={state.recipes} days={state.days} />}
        </main>
      </div>
    </I18nContext.Provider>
  );
}

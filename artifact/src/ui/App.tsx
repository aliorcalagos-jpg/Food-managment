import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, I18nContext, makeI18n, type Lang } from "../i18n";
import { MoneyContext } from "../money-context";
import { todayISO } from "../today";
import { useStore, type Store } from "../store";
import { Empty } from "./common";
import { Expenses } from "./Expenses";
import { Lists } from "./Lists";
import { Recipes } from "./Recipes";
import { Week } from "./Week";

const TABS = [
  { id: "expenses", label: "tabExpenses" },
  { id: "week", label: "tabWeek" },
  { id: "recipes", label: "tabRecipes" },
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
  return "expenses";
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
  const lang: Lang = state.settings.lang ?? localLang ?? DEFAULT_LANG;
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
    void store.updateSettings({ lang: next });
  };

  // Jumping from a shopping trip on the Expenses tab opens that list; the key remounts the Lists tab on it.
  const [open, setOpen] = useState<{ id: string | null; key: number }>({ id: null, key: 0 });
  const openList = (id: string) => {
    setOpen((o) => ({ id, key: o.key + 1 }));
    choose("lists");
  };
  // Jumping from a food with no ingredients on This week opens its edit form.
  const [edit, setEdit] = useState<{ id: string | null; key: number }>({ id: null, key: 0 });
  const editRecipe = (id: string) => {
    setEdit((e) => ({ id, key: e.key + 1 }));
    choose("recipes");
  };
  const startTrip = async () => {
    const date = todayISO();
    const id = await store.createList({
      name: i18n.t("tripDefaultName", { date }),
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
          {state.status === "ready" && tab === "expenses" && (
            <Expenses store={store} lists={state.lists} settings={state.settings} onOpenList={openList} onStartTrip={() => void startTrip()} />
          )}
          {state.status === "ready" && tab === "week" && (
            <Week store={store} recipes={state.recipes} weeks={state.weeks} lists={state.lists} onEditRecipe={editRecipe} onOpenList={openList} />
          )}
          {state.status === "ready" && tab === "recipes" && <Recipes key={edit.key} store={store} recipes={state.recipes} initialEditId={edit.id} />}
          {state.status === "ready" && tab === "lists" && <Lists key={open.key} store={store} lists={state.lists} initialListId={open.id} />}
        </main>
      </div>
     </MoneyContext.Provider>
    </I18nContext.Provider>
  );
}

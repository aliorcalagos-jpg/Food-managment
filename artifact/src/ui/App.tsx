import { useState } from "react";
import { useStore, type Store } from "../store";
import { Empty } from "./common";
import { Lists } from "./Lists";
import { Planner } from "./Planner";
import { Recipes } from "./Recipes";

const TABS = [
  { id: "recipes", label: "Recipes" },
  { id: "planner", label: "Planner" },
  { id: "lists", label: "Lists" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const TAB_KEY = "meal-planner:tab";

// A remembered tab is only a convenience: storage can be blocked or empty.
function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (TABS.some((x) => x.id === t)) return t as Tab;
  } catch {
    /* storage unavailable */
  }
  return "recipes";
}

export function App({ store }: { store: Store }) {
  const state = useStore(store);
  const [tab, setTab] = useState<Tab>(readTab);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand">Meal Planner</h1>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => choose(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {state.error && state.status !== "unavailable" && (
        <div className="banner error" role="alert">
          <span>{state.error}</span>
          <button type="button" className="link" onClick={store.dismissError}>
            Dismiss
          </button>
        </div>
      )}

      <main className="main">
        {state.status === "loading" && <Empty title="Loading your kitchen…" />}
        {state.status === "unavailable" && (
          <Empty title="Your recipes can't be opened right now">
            This page keeps everything in your claude.ai account, so open it from claude.ai while signed in as its owner.
          </Empty>
        )}
        {state.status === "ready" && tab === "recipes" && <Recipes store={store} recipes={state.recipes} />}
        {state.status === "ready" && tab === "planner" && <Planner store={store} recipes={state.recipes} days={state.days} />}
        {state.status === "ready" && tab === "lists" && <Lists store={store} lists={state.lists} recipes={state.recipes} days={state.days} />}
      </main>
    </div>
  );
}

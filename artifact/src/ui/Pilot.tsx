/* eslint-disable react-hooks/set-state-in-effect -- Pilot mirrors what is on the page (the DOM) and the data into state; the page gives no event for most of it */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { startOfWeek, parseISODate, toISODate } from "../../../lib/week";
import { useI18n, type MsgKey } from "../i18n";
import { weekListId } from "../model";
import { advance, currentStep, emptyFacts, progress, stepsFor, suggestWorkflow, workflow, workflows, type Baseline, type Facts, type PilotTab, type WorkflowId } from "../pilot";
import type { State } from "../store";
import { todayISO } from "../today";

const KEY = "meal-planner:pilot";
type Saved = { x: number; y: number } | null;

/** Per-device conveniences only (where the button sits); the guide's progress is always worked out from the data. */
function readPos(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null;
  } catch {
    return null;
  }
}
function writePos(p: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

const q = (anchor: string) => document.querySelector<HTMLElement>(`[data-pilot="${anchor}"]`);
const value = (anchor: string) => (q(anchor) as HTMLInputElement | null)?.value ?? "";

/** What is on screen right now, read from the controls the guide points at. */
function probe(): Facts["ui"] {
  const add = q("sheet-add") as HTMLButtonElement | null;
  return {
    formOpen: !!q("food-title"),
    titleTyped: value("food-title").trim() !== "",
    sheetOpen: !!q("sheet-input"),
    nameFilled: value("sheet-input").trim() !== "",
    addEnabled: !!add && !add.disabled,
    ingredientRows: document.querySelectorAll('[data-pilot="ing-line"]').length,
    listOpen: !!q("list-detail"),
  };
}

/** The first of these controls that is on screen, with where it is. */
function findTarget(anchors: string[]): { el: HTMLElement; rect: DOMRect } | null {
  for (const a of anchors) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-pilot="${a}"]`)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return { el, rect };
    }
  }
  return null;
}

function Compass() {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  );
}

export function Pilot({ state, tab, go }: { state: State; tab: PilotTab; go: (tab: PilotTab) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [wfId, setWfId] = useState<WorkflowId | null>(null);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [base, setBase] = useState<Baseline>({ foodsWithIngredients: 0 });
  const [ui, setUi] = useState(emptyFacts().ui);
  const [seen, setSeen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pos, setPos] = useState<Saved>(readPos);
  const [ring, setRing] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [place, setPlace] = useState<"top" | "bottom">("bottom");
  const cardRef = useRef<HTMLDivElement>(null);
  const [ringLow, setRingLow] = useState(false);

  // ---- facts -----------------------------------------------------------------------------------
  const facts: Facts = useMemo(() => {
    const monday = toISODate(startOfWeek(parseISODate(todayISO())!));
    const week = state.weeks.find((w) => w.weekStart === monday);
    const picks = week?.picks ?? [];
    const byId = new Map(state.recipes.map((r) => [r.id, r]));
    const list = state.lists.find((l) => l.id === weekListId(monday));
    return {
      tab,
      foods: state.recipes.length,
      foodsWithIngredients: state.recipes.filter((r) => r.ingredients.length > 0).length,
      picks: picks.length,
      pickedBare: picks.filter((p) => byId.get(p.recipeId) && byId.get(p.recipeId)!.ingredients.length === 0).length,
      weekList: !!list,
      items: list?.items.length ?? 0,
      ticked: list?.items.filter((i) => i.checked).length ?? 0,
      priced: list?.items.filter((i) => i.price !== null).length ?? 0,
      budget: state.settings.weeklyBudget !== null,
      ui,
    };
  }, [state, tab, ui]);

  // Read the screen after every render, and whenever something changes that React does not tell us about (typing).
  const recompute = useCallback(() => {
    const next = probe();
    setUi((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);
  useEffect(recompute);
  useEffect(() => {
    let raf = 0;
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };
    document.addEventListener("input", later, true);
    document.addEventListener("click", later, true);
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("input", later, true);
      document.removeEventListener("click", later, true);
      mo.disconnect();
    };
  }, [recompute]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  // ---- progress --------------------------------------------------------------------------------
  const wf = wfId ? workflow(wfId) : null;
  const cur = wf ? currentStep(wf, facts, done) : null;
  useEffect(() => {
    if (!wf) return;
    const next = advance(wf, facts, base, done);
    if (next.size === done.size) return;
    const finished = stepsFor(wf, facts).find((s) => next.has(s.id) && !done.has(s.id));
    setDone(next);
    if (finished) setNote(t("pilotNice", { title: t(finished.titleKey as MsgKey) }));
  }, [wf, facts, base, done, t]);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 2600);
    return () => clearTimeout(id);
  }, [note]);

  const start = (id: WorkflowId) => {
    setWfId(id);
    setDone(new Set());
    setBase({ foodsWithIngredients: facts.foodsWithIngredients });
    setNote(null);
  };
  const stop = () => {
    setWfId(null);
    setDone(new Set());
    setNote(null);
  };

  // ---- the highlight follows its control (it can move, scroll or animate) ----------------------
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!cur) {
      setRing(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const hit = findTarget(cur.targets);
      if (hit) {
        const pad = 6;
        const next = { top: hit.rect.top - pad, left: hit.rect.left - pad, width: hit.rect.width + pad * 2, height: hit.rect.height + pad * 2 };
        setRing((p) => (p && Math.abs(p.top - next.top) < 0.5 && Math.abs(p.left - next.left) < 0.5 && Math.abs(p.width - next.width) < 0.5 && Math.abs(p.height - next.height) < 0.5 ? p : next));
        setRingLow(hit.rect.top + hit.rect.height / 2 > window.innerHeight * 0.5);
        if (scrolledFor.current !== cur.id) {
          scrolledFor.current = cur.id;
          const off = hit.rect.top < 60 || hit.rect.bottom > window.innerHeight - 90;
          if (off) hit.el.scrollIntoView({ block: "center", behavior: "auto" });
        }
      } else setRing((p) => (p ? null : p));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cur]);

  // The card goes wherever it does not sit on the control it is pointing at.
  useLayoutEffect(() => {
    if (!open) return;
    const h = cardRef.current?.offsetHeight ?? 240;
    const vh = window.innerHeight;
    const navH = document.querySelector<HTMLElement>(".bottom-nav")?.offsetHeight ?? 0;
    const bottom = { a: vh - navH - 8 - h, b: vh - navH - 8 };
    const top = { a: 8, b: 8 + h };
    const over = (r: { a: number; b: number }) => (ring ? Math.max(0, Math.min(r.b, ring.top + ring.height) - Math.max(r.a, ring.top)) : 0);
    const next = over(bottom) <= over(top) ? "bottom" : "top";
    setPlace((p) => (p === next ? p : next));
  }, [open, ring, wfId, done, note]);

  const showMe = () => {
    const hit = cur ? findTarget(cur.targets) : null;
    hit?.el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  // ---- the floating button: tap to open, drag to move ------------------------------------------
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const clamp = (x: number, y: number) => ({ x: Math.max(8, Math.min(window.innerWidth - 60, x)), y: Math.max(8, Math.min(window.innerHeight - 60, y)) });
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const suggested = suggestWorkflow(facts);
  const tabOf = cur?.targets[0].startsWith("nav-") ? (cur.targets[0].slice(4) as PilotTab) : null;
  const prog = wf ? progress(wf, facts, done) : null;
  const showCallout = !!cur && !open && ring;

  return (
    <>
      {cur && ring && (
        <div className="pilot-ring" aria-hidden="true" data-testid="pilot-ring" style={{ top: ring.top, left: ring.left, width: ring.width, height: ring.height }} />
      )}

      {showCallout && cur && ring && (
        <div className={`pilot-callout${ringLow ? " above" : ""}`} role="status" style={{ top: ringLow ? undefined : ring.top + ring.height + 8, bottom: ringLow ? window.innerHeight - ring.top + 8 : undefined }}>
          <strong>{t(cur.titleKey as MsgKey)}</strong>
          <span>{t(cur.bodyKey as MsgKey)}</span>
          {cur.ack && (
            <button type="button" className="btn primary" onClick={() => setDone(new Set([...done, cur.id]))}>
              {t("pilotNext")}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className={`pilot-fab${pos ? " placed" : ""}`}
        data-pilot-ui="fab"
        aria-label={t("pilotOpen")}
        aria-expanded={open}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          drag.current = { x: e.clientX, y: e.clientY, ox: r.left, oy: r.top, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
          d.moved = true;
          setPos(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.moved) setPos((p) => (writePos(p), p));
          else {
            setOpen((o) => !o);
            setSeen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
            setSeen(true);
          }
        }}
      >
        <Compass />
        {!seen && !wf && <span className="pilot-dot" aria-hidden="true" />}
        {wf && prog && <span className="pilot-badge" aria-hidden="true">{prog.done}/{prog.total}</span>}
      </button>

      {open && (
        <div
          ref={cardRef}
          className={`pilot-card${place === "top" ? " top" : ""}`}
          role="dialog"
          aria-label={t("pilotName")}
          data-pilot-ui="card"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="pilot-head">
            <h3>{wf ? t(wf.titleKey as MsgKey) : t("pilotName")}</h3>
            <span className="pilot-head-actions">
              {wf && (
                <button type="button" className="link" onClick={stop}>
                  {t("pilotBack")}
                </button>
              )}
              <button type="button" className="sheet-close" aria-label={t("pilotClose")} onClick={() => setOpen(false)}>
                ✕
              </button>
            </span>
          </div>

          {!wf && (
            <>
              <p className="muted">{t("pilotWhat")}</p>
              <ul className="pilot-list">
                {workflows().map((w) => (
                  <li key={w.id}>
                    <button type="button" className="pilot-choice" onClick={() => start(w.id)}>
                      <span>
                        <strong>{t(w.titleKey as MsgKey)}</strong>
                        <small>{t(w.subKey as MsgKey)}</small>
                      </span>
                      {w.id === suggested && <span className="pill">{t("pilotSuggested")}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {wf && prog && (
            <>
              <ol className="pilot-steps" aria-label={t(wf.titleKey as MsgKey)}>
                {stepsFor(wf, facts).map((s) => (
                  <li key={s.id} className={done.has(s.id) ? "is-done" : s.id === cur?.id ? "now" : ""} aria-current={s.id === cur?.id ? "step" : undefined}>
                    <span className="pilot-mark" aria-hidden="true">{done.has(s.id) ? "✓" : ""}</span>
                    <span className="sr-only">{t(s.titleKey as MsgKey)}</span>
                  </li>
                ))}
              </ol>
              {cur ? (
                <div className="pilot-step" aria-live="polite">
                  <p className="muted small">{note ?? t("pilotStepOf", { n: prog.done + 1, total: prog.total })}</p>
                  <h4>{t(cur.titleKey as MsgKey)}</h4>
                  <p>{t(cur.bodyKey as MsgKey)}</p>
                  {!ring && <p className="muted small">{t("pilotNoTarget")}</p>}
                  <div className="actions">
                    {tabOf && tabOf !== tab && (
                      <button type="button" className="btn primary" onClick={() => go(tabOf)}>
                        {t("pilotGoTab")}
                      </button>
                    )}
                    {cur.ack ? (
                      <button type="button" className="btn primary" onClick={() => setDone(new Set([...done, cur.id]))}>
                        {t("pilotNext")}
                      </button>
                    ) : (
                      <button type="button" className="btn primary" onClick={showMe}>
                        {t("pilotShow")}
                      </button>
                    )}
                    <button type="button" className="btn ghost" onClick={() => setDone(new Set([...done, cur.id]))}>
                      {t("pilotSkip")}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="pilot-note" role="status">
                  {t("pilotAllDone")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

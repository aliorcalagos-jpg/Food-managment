// Effects level, kept per device: "full" (everything), "calm" (only fades and the tick) or "off". The page sets
// data-fx on <html> and the stylesheet does the rest; people who asked their phone for reduced motion start on "calm".
export type Fx = "full" | "calm" | "off";
export const FX_KEY = "meal-planner:fx";
export const FX_LEVELS: Fx[] = ["full", "calm", "off"];
const isFx = (v: unknown): v is Fx => v === "full" || v === "calm" || v === "off";

export function readFx(): Fx {
  try {
    const v = localStorage.getItem(FX_KEY);
    if (isFx(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "calm" : "full";
}

export const currentFx = (): Fx => {
  const v = document.documentElement.dataset.fx;
  return isFx(v) ? v : "full";
};

export function setFx(level: Fx) {
  document.documentElement.dataset.fx = level;
  try {
    localStorage.setItem(FX_KEY, level);
  } catch {
    /* storage unavailable */
  }
}

/** Sets the level on <html> and starts the touch ripple. Returns a function that stops it. */
export function installFx(): () => void {
  document.documentElement.dataset.fx = readFx();
  const onDown = (e: PointerEvent) => {
    if (currentFx() !== "full") return;
    const el = (e.target as Element | null)?.closest<HTMLElement>(".btn, .chip, .tile, .add-btn, .nav-btn, .week-btn, .pick-btn");
    if (!el || (el as HTMLButtonElement).disabled) return;
    const r = el.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.setAttribute("aria-hidden", "true");
    const size = Math.max(r.width, r.height) * 1.6;
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
    setTimeout(() => dot.remove(), 900);
  };
  document.addEventListener("pointerdown", onDown, { passive: true });
  return () => document.removeEventListener("pointerdown", onDown);
}

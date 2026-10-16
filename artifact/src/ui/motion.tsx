import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { currentFx } from "../fx";

/** A number that rolls to its new value instead of jumping (not on first show, and not when effects are off). */
export function useTween(target: number, ms = 450): number {
  const [shown, setShown] = useState(target);
  const current = useRef(target); // what is on screen right now, so a new target starts from there
  useEffect(() => {
    if (currentFx() === "off" || current.current === target) {
      current.current = target;
      setShown(target);
      return;
    }
    const a = current.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      current.current = p < 1 ? a + (target - a) * (1 - Math.pow(1 - p, 3)) : target;
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return currentFx() === "off" ? target : shown;
}

/** True once `value` has changed (never before): used to flash what just changed. */
export function useChanged<T>(value: T): boolean {
  const [seen, setSeen] = useState(value);
  const [changed, setChanged] = useState(false);
  if (seen !== value) {
    setSeen(value);
    setChanged(true);
  }
  return changed;
}

/** A burst of gold sparks, for finishing a list. It removes itself. */
export function Burst({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1100);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ "--a": `${(360 / 14) * i}deg`, "--d": `${46 + (i % 3) * 16}px` } as React.CSSProperties} />
      ))}
    </span>
  );
}

type ToastSpec = { text: string; action?: { label: string; run: () => void } };
const ToastContext = createContext<(t: ToastSpec) => void>(() => {});
export const useToast = () => useContext(ToastContext);

/** "Removed. Undo" at the bottom: lets an action happen at once and be taken back, instead of asking first. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastSpec & { n: number }) | null>(null);
  const n = useRef(0);
  const show = useCallback((t: ToastSpec) => setToast({ ...t, n: ++n.current }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" key={toast.n} role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="link"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

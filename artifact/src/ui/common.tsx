import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { itemKey, aisleSummary, type Source } from "../../../lib/list-build";
import { tidyAmount } from "../../../lib/ingredients";
import { formatMoney } from "../../../lib/money";
import { formatQuantity } from "../../../lib/quantity";
import { useMoney } from "../money-context";
import { unitLabel, useI18n, type Msg } from "../i18n";
import { useChanged, useTween } from "./motion";
import { ACTION_W, clampOffset, logicalDx, physicalShift, swipeEnd } from "../swipe";

/** A destructive action confirmed in an iOS-style action sheet. The viewer never shows confirm() dialogs. */
export function ConfirmAction({
  label,
  confirmLabel,
  onConfirm,
  className = "link danger",
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) cancel.current?.focus();
  }, [asking]);
  return (
    <>
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
      {asking && (
        <div className="sheet-overlay action-overlay" onMouseDown={(e) => e.target === e.currentTarget && setAsking(false)} onKeyDown={(e) => e.key === "Escape" && setAsking(false)}>
          <div className="action-sheet" role="dialog" aria-modal="true" aria-label={label}>
            <div className="action-group">
              <p className="action-title">{label}</p>
              <button
                type="button"
                className="action-btn danger"
                onClick={() => {
                  setAsking(false);
                  onConfirm();
                }}
              >
                {confirmLabel}
              </button>
            </div>
            <button type="button" ref={cancel} className="action-btn cancel" onClick={() => setAsking(false)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** An error message given as a translatable key, shown in the current language. */
export function FieldError({ id, msg }: { id: string; msg?: Msg | null }) {
  const { t } = useI18n();
  return msg ? (
    <p id={id} className="field-error" role="alert">
      {t(msg.key, msg.params)}
    </p>
  ) : null;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

/** A decorative arrow. It is drawn pointing "back" or "forward" for left-to-right and mirrored by CSS in right-to-left. */
export function Arrow({ forward = false }: { forward?: boolean }) {
  return (
    <span className="arrow" aria-hidden="true">
      {forward ? "›" : "‹"}
    </span>
  );
}

/**
 * "1 1/2 cup flour" / "1 1/2 كوب دقيق". The quantity is an isolated left-to-right run so a mixed
 * number never gets visually reordered inside right-to-left text, and the name is isolated so
 * Arabic and English names each keep their own direction.
 */
export function ItemLabel({ quantity, unit, name }: { quantity: number; unit: string; name: string }) {
  const { lang } = useI18n();
  const shown = tidyAmount(quantity, unit); // 1500 g reads 1.5 kg
  const changed = useChanged(shown.quantity); // a quantity that just changed flashes gold
  return (
    <>
      <bdi dir="ltr" key={shown.quantity} className={changed ? "flash" : undefined}>
        {formatQuantity(shown.quantity)}
      </bdi>
      {shown.unit ? <> {unitLabel(lang, shown.unit)}</> : null} <bdi>{name}</bdi>
    </>
  );
}

/** "Needed for Kofta 1 kg · Chicken rice 0.5 kg": which foods need a line and how much each. One food shows just its name. */
export function NeededFor({ sources }: { sources: Source[] }) {
  const { t, lang } = useI18n();
  if (sources.length === 0) return null;
  return (
    <span className="needed muted small">
      {t("neededFor")}{" "}
      {sources.map((s, n) => {
        const a = tidyAmount(s.quantity, s.unit);
        return (
          <span key={s.title}>
            {n > 0 && " · "}
            <bdi>{s.title}</bdi>
            {sources.length > 1 && (
              <>
                {" "}
                <bdi dir="ltr">{formatQuantity(a.quantity)}</bdi>
                {a.unit ? <> {unitLabel(lang, a.unit)}</> : null}
              </>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Under an aisle's title: how many foods use it and, for meat and fish, how much to buy in total. */
export function AisleSummary({ category, items, sourcesOf }: { category: string; items: { name: string; quantity: number; unit: string }[]; sourcesOf: (i: { name: string; unit: string }) => Source[] }) {
  const { t, lang } = useI18n();
  const sum = aisleSummary(items, sourcesOf);
  if (sum.dishes === 0) return null;
  const dishes = sum.dishes === 1 ? t("aisleDishOne") : sum.dishes === 2 ? t("aisleDishTwo") : t("aisleDishN", { n: sum.dishes });
  const showWeight = category === "Meat & fish" && sum.grams !== null;
  const w = showWeight ? tidyAmount(Math.round(sum.grams! * 10) / 10, "g") : null;
  return (
    <p className="aisle-sum num" data-aisle-summary={category}>
      {dishes}
      {w && (
        <>
          {" · "}
          <strong>{t("aisleWeight", { w: `${formatQuantity(w.quantity)} ${unitLabel(lang, w.unit)}` })}</strong>
          {sum.byCount > 0 && <> {t("aisleByCount", { n: sum.byCount })}</>}
        </>
      )}
    </p>
  );
}

/**
 * An amount in the chosen currency, as a left-to-right run so "₦2,500" is never reordered inside Arabic text.
 * `withOther` adds the other currency in small type ("≈ $1.81"); `onlyOther` shows just that.
 */
export function Money({ kobo, withOther = false, onlyOther = false }: { kobo: number; withOther?: boolean; onlyOther?: boolean }) {
  const { currency, rate } = useMoney();
  const { t } = useI18n();
  const other = currency === "NGN" ? "USD" : "NGN";
  const rolling = Math.round(useTween(kobo)); // amounts roll to their new value
  return (
    <>
      {!onlyOther && (
        <bdi dir="ltr" className="money">
          {formatMoney(rolling, currency, rate)}
        </bdi>
      )}
      {(withOther || onlyOther) && (
        <small className="muted other-money">
          {" "}
          <bdi dir="ltr">{t("approx", { amount: formatMoney(kobo, other, rate) })}</bdi>
        </small>
      )}
    </>
  );
}

const WIDE = "(min-width: 900px)";
/** True on screens wide enough to show the what-to-buy list beside the foods instead of in a sheet. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(WIDE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/** A bottom sheet with a grabber (a centred dialog on wide screens). Drag it down, press Escape or tap outside to close. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus();
    return () => before?.focus?.();
  }, []);
  const shift = (dy: number) => {
    if (ref.current) ref.current.style.transform = dy ? `translateY(${dy}px)` : "";
  };
  return (
    <div className="sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div
          className="sheet-grab"
          onPointerDown={(e) => {
            if (e.target instanceof Element && e.target.closest("button")) return;
            drag.current = { y: e.clientY, dy: 0 };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            drag.current.dy = Math.max(0, e.clientY - drag.current.y);
            shift(drag.current.dy);
          }}
          onPointerUp={() => {
            const dy = drag.current?.dy ?? 0;
            drag.current = null;
            if (dy > 110) onClose();
            else shift(0);
          }}
          onPointerCancel={() => {
            drag.current = null;
            shift(0);
          }}
        >
          <div className="sheet-head">
            <h3>{title}</h3>
            <button type="button" className="sheet-close" aria-label={t("close")} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A big − / number / + control for whole numbers. */
export function Stepper({
  value,
  onChange,
  label,
  fewer,
  more,
  count,
  min = 1,
  max = 100,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  fewer: string;
  more: string;
  count: string;
  min?: number;
  max?: number;
}) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" className="icon-btn" aria-label={fewer} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output className="num stepper-n" aria-label={count}>
        {value}
      </output>
      <button type="button" className="icon-btn" aria-label={more} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}

const ICONS = {
  week: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  foods: <><path d="M4 12h16c0 5-3 8-8 8s-8-3-8-8z" /><path d="M9 8c0-1.5 1-2 1-3.5M14 8c0-1.5 1-2 1-3.5" /></>,
  shopping: <><path d="M3 9h18l-2 10H5z" /><path d="M8 9l3-5M16 9l-3-5" /></>,
  spending: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10.5h18" /><circle cx="16.5" cy="15" r="1" /></>,
};
export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/**
 * A list row that can be swiped like in Mail or Reminders: toward the trailing edge reveals Delete (a long swipe
 * deletes), toward the leading edge ticks. Directions mirror in right-to-left text. Buttons inside the row stay
 * the keyboard and screen-reader way to do the same things.
 */
export function SwipeRow({
  children,
  contentClass,
  onDelete,
  onToggle,
  deleteLabel,
  toggleLabel,
}: {
  children: ReactNode;
  contentClass?: string;
  onDelete?: () => void;
  onToggle?: () => void;
  deleteLabel: string;
  toggleLabel?: string;
}) {
  const { dir } = useI18n();
  const rtl = dir === "rtl";
  const hasToggle = !!onToggle;
  const hasDelete = !!onDelete;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const rowRef = useRef<HTMLLIElement>(null);
  const drag = useRef<{ x: number; y: number; base: number; active: boolean } | null>(null);
  const swiped = useRef(false);
  const move = useCallback((n: number) => {
    offsetRef.current = n;
    setOffset(n);
  }, []);
  const open = offset === -ACTION_W && !dragging;

  // an open row closes when you tap somewhere else or press Escape
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) move(0);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && move(0);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, move]);

  const finish = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    setDragging(false);
    swiped.current = true;
    setTimeout(() => (swiped.current = false), 0);
    const end = swipeEnd(offsetRef.current, hasToggle, hasDelete);
    if (end === "toggle") {
      move(0);
      onToggle?.();
    } else if (end === "delete") {
      move(0);
      onDelete?.();
    } else move(end === "open" ? -ACTION_W : 0);
  };

  return (
    <li ref={rowRef} className={`swipe${dragging ? " dragging" : ""}${offset > 0 ? " revealing-lead" : ""}${offset < 0 ? " revealing-trail" : ""}`}>
      {hasToggle && (
        <button type="button" tabIndex={-1} aria-hidden="true" className="swipe-act swipe-lead" onClick={() => { move(0); onToggle?.(); }}>
          {toggleLabel}
        </button>
      )}
      {hasDelete && (
        <button type="button" tabIndex={-1} aria-hidden="true" className="swipe-act swipe-trail" onClick={() => { move(0); onDelete?.(); }}>
          {deleteLabel}
        </button>
      )}
      <div
        className={`swipe-content ${contentClass ?? ""}`}
        style={{ transform: offset ? `translateX(${physicalShift(offset, rtl)}px)` : undefined }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, base: offsetRef.current, active: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.active) {
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            d.active = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          move(clampOffset(d.base + logicalDx(dx, rtl), hasToggle, hasDelete));
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          if (swiped.current || offsetRef.current < 0) {
            e.stopPropagation();
            e.preventDefault();
            if (offsetRef.current < 0 && !swiped.current) move(0);
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}

/** Looks up the foods behind a line of a buy list (see `buildBuyList`). */
export const sourcesLookup = (map: Map<string, Source[]>) => (i: { name: string; unit: string }): Source[] => map.get(itemKey(i.name, i.unit)) ?? [];

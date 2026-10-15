import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatMoney } from "../../../lib/money";
import { formatQuantity } from "../../../lib/quantity";
import { useMoney } from "../money-context";
import { unitLabel, useI18n, type Msg } from "../i18n";

/** Two-step inline confirmation. The viewer never shows confirm() dialogs. */
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
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={label}>
      <button
        type="button"
        className="btn danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn ghost" onClick={() => setAsking(false)}>
        {t("cancel")}
      </button>
    </span>
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
      {forward ? "→" : "←"}
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
  return (
    <>
      <bdi dir="ltr">{formatQuantity(quantity)}</bdi>
      {unit ? <> {unitLabel(lang, unit)}</> : null} <bdi>{name}</bdi>
    </>
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
  return (
    <>
      {!onlyOther && (
        <bdi dir="ltr" className="money">
          {formatMoney(kobo, currency, rate)}
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

/** A bottom sheet (a centred dialog on wide screens). Escape or a tap outside closes it; focus returns where it was. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus();
    return () => before?.focus?.();
  }, []);
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
        <div className="sheet-head">
          <h3>{title}</h3>
          <button type="button" className="sheet-close" aria-label={t("close")} onClick={onClose}>
            ✕
          </button>
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

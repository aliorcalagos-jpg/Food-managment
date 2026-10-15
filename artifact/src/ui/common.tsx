import { useState, type ReactNode } from "react";
import { formatQuantity } from "../../../lib/quantity";
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

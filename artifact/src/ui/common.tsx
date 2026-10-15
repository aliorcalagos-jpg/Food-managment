import { useState, type ReactNode } from "react";

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
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={`Confirm: ${label}`}>
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
        Cancel
      </button>
    </span>
  );
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  return children ? (
    <p id={id} className="field-error" role="alert">
      {children}
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

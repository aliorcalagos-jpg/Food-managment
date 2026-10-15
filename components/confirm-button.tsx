"use client";

/** A button inside a form that asks for confirmation before running a (bound) server action. */
export function ConfirmButton({
  action,
  label,
  message,
  className = "text-sm text-red-600 underline",
}: {
  action: () => Promise<void>;
  label: string;
  message: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <button className={className}>{label}</button>
    </form>
  );
}

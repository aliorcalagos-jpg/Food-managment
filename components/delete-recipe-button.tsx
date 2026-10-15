"use client";

export function DeleteRecipeButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this recipe? This can't be undone.")) e.preventDefault();
      }}
    >
      <button className="text-sm text-red-600 underline">Delete</button>
    </form>
  );
}

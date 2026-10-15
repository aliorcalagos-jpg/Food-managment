import Link from "next/link";
import { notFound } from "next/navigation";
import { clearCheckedAction, deleteListAction, removeItemAction } from "@/app/actions/lists";
import { ConfirmButton } from "@/components/confirm-button";
import { AddItemForm, ItemCheckbox } from "@/components/list-forms";
import { requireHousehold } from "@/lib/dal";
import { groupItems, getList } from "@/lib/list-service";
import { formatQuantity } from "@/lib/quantity";
import { formatRange } from "@/lib/week";

// Reads the session: blocks on the server (see authentication-with-cache-components guide).
export const instant = false;

export default async function ListPage({ params }: PageProps<"/lists/[id]">) {
  const { householdId } = await requireHousehold();
  const { id } = await params;
  const list = await getList(householdId, id);
  if (!list) notFound();

  const done = list.items.filter((i) => i.checked).length;
  const groups = groupItems(list.items);

  return (
    <div className="space-y-6">
      <Link href="/lists" className="text-sm underline">← All lists</Link>
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">{list.name}</h1>
          <ConfirmButton action={deleteListAction.bind(null, list.id)} label="Delete list" message="Delete this whole list? This can't be undone." />
        </div>
        <p className="text-sm text-zinc-500">
          {list.rangeStart && list.rangeEnd && <>{formatRange(list.rangeStart, list.rangeEnd)} · </>}
          <span aria-live="polite">{done} of {list.items.length} done</span>
        </p>
      </header>

      <AddItemForm listId={list.id} />

      {list.items.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">This list is empty. Add your first item above.</p>}

      {groups.map((g) => (
        <section key={g.category} aria-label={g.category} className="space-y-1">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">{g.category}</h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {g.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <ItemCheckbox
                  itemId={item.id}
                  checked={item.checked}
                  label={[formatQuantity(item.quantity), item.unit, item.name].filter(Boolean).join(" ")}
                />
                <form action={removeItemAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button aria-label={`Remove ${item.name}`} className="px-2 text-zinc-400 hover:text-red-600">✕</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {done > 0 && (
        <ConfirmButton
          action={clearCheckedAction.bind(null, list.id)}
          label={`Clear ${done} checked item${done === 1 ? "" : "s"}`}
          message="Remove all checked items from this list?"
          className="text-sm underline"
        />
      )}
    </div>
  );
}

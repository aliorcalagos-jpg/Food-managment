import Link from "next/link";
import { BlankListForm, GenerateListForm } from "@/components/list-forms";
import { requireHousehold } from "@/lib/dal";
import { listLists } from "@/lib/list-service";
import { formatRange, resolveWeekStart, toISODate, addDays } from "@/lib/week";

// Reads the session: blocks on the server (see authentication-with-cache-components guide).
export const instant = false;

export default async function ListsPage() {
  const { householdId } = await requireHousehold();
  const lists = await listLists(householdId);
  const weekStart = resolveWeekStart(undefined);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Shopping lists</h1>

      <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">New list</h2>
        <GenerateListForm defaultStart={toISODate(weekStart)} defaultEnd={toISODate(addDays(weekStart, 6))} />
        <BlankListForm />
      </section>

      {lists.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No lists yet. Plan some meals, then generate one above.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/lists/${l.id}`} className="flex items-baseline justify-between gap-4 py-3">
                <span>
                  <span className="font-medium">{l.name}</span>
                  {l.rangeStart && l.rangeEnd && (
                    <span className="ml-2 text-sm text-zinc-500">{formatRange(l.rangeStart, l.rangeEnd)}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-zinc-500">
                  {l.done} of {l.total} done
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

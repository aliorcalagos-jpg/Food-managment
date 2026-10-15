import Link from "next/link";
import { addMealAction, removeMealAction, updateMealAction } from "@/app/actions/planner";
import { requireHousehold } from "@/lib/dal";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/meals";
import { getWeekPlan } from "@/lib/plan-service";
import { listRecipes } from "@/lib/recipe-service";
import { addDays, formatDay, formatWeekRange, resolveWeekStart, toISODate, weekDays } from "@/lib/week";

// Reads the session: blocks on the server (see authentication-with-cache-components guide).
export const instant = false;

const field =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const { householdId } = await requireHousehold();
  const sp = await searchParams;
  const weekStart = resolveWeekStart(typeof sp.week === "string" ? sp.week : undefined);
  const [entries, recipes] = await Promise.all([getWeekPlan(householdId, weekStart), listRecipes(householdId)]);
  const thisWeek = toISODate(resolveWeekStart(undefined));
  const link = (d: Date) => ({ pathname: "/planner", query: { week: toISODate(d) } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Meal planner</h1>
        <nav aria-label="Week" className="flex items-center gap-3 text-sm">
          <Link href={link(addDays(weekStart, -7))} className="underline">← Previous</Link>
          <span className="font-medium" aria-live="polite">{formatWeekRange(weekStart)}</span>
          <Link href={link(addDays(weekStart, 7))} className="underline">Next →</Link>
          {toISODate(weekStart) !== thisWeek && <Link href="/planner" className="underline">This week</Link>}
        </nav>
      </div>

      {recipes.length === 0 && (
        <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
          You need a recipe before you can plan meals. <Link className="underline" href="/recipes/new">Add one</Link>.
        </p>
      )}

      <div className="space-y-4">
        {weekDays(weekStart).map((day) => {
          const iso = toISODate(day);
          return (
            <section key={iso} aria-label={formatDay(day)} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-3 font-medium">{formatDay(day)}</h2>
              <div className="space-y-3">
                {MEAL_TYPES.map((meal) => {
                  const slot = entries.filter((e) => toISODate(e.date) === iso && e.mealType === meal);
                  return (
                    <div key={meal} className="grid gap-2 sm:grid-cols-[6rem_1fr]">
                      <h3 className="text-sm text-zinc-500">{MEAL_LABELS[meal]}</h3>
                      <div className="space-y-2">
                        {slot.map((e) => (
                          <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <Link href={`/recipes/${e.recipe.id}`} className="font-medium underline">{e.recipe.title}</Link>
                            <form action={updateMealAction} className="flex items-center gap-1">
                              <input type="hidden" name="entryId" value={e.id} />
                              <label className="sr-only" htmlFor={`s-${e.id}`}>Servings for {e.recipe.title}</label>
                              <input id={`s-${e.id}`} name="servings" type="number" min={1} max={100} defaultValue={e.servings} className={`${field} w-16`} />
                              <span className="text-zinc-500">servings</span>
                              <button className="underline">Update</button>
                            </form>
                            <form action={removeMealAction}>
                              <input type="hidden" name="entryId" value={e.id} />
                              <button aria-label={`Remove ${e.recipe.title} from ${MEAL_LABELS[meal]} on ${formatDay(day)}`} className="text-red-600 underline">Remove</button>
                            </form>
                          </div>
                        ))}
                        {recipes.length > 0 && (
                          <details>
                            <summary className="cursor-pointer text-sm underline">Add a recipe</summary>
                            <form action={addMealAction} className="mt-2 flex flex-wrap items-center gap-2">
                              <input type="hidden" name="date" value={iso} />
                              <input type="hidden" name="mealType" value={meal} />
                              <label className="sr-only" htmlFor={`r-${iso}-${meal}`}>Recipe for {MEAL_LABELS[meal]} on {formatDay(day)}</label>
                              <select id={`r-${iso}-${meal}`} name="recipeId" required className={field}>
                                {recipes.map((r) => (
                                  <option key={r.id} value={r.id}>{r.title}</option>
                                ))}
                              </select>
                              <label className="sr-only" htmlFor={`n-${iso}-${meal}`}>Servings (optional)</label>
                              <input id={`n-${iso}-${meal}`} name="servings" type="number" min={1} max={100} placeholder="servings" className={`${field} w-24`} />
                              <button className="rounded-md bg-emerald-700 px-3 py-1 text-sm font-medium text-white">Add</button>
                            </form>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

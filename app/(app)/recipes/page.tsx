import Link from "next/link";
import { requireHousehold } from "@/lib/dal";
import { listRecipes, listTags } from "@/lib/recipe-service";

// Reads the session: blocks on the server (see authentication-with-cache-components guide).
export const instant = false;

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const { householdId } = await requireHousehold();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const [recipes, tags] = await Promise.all([listRecipes(householdId, { q, tag }), listTags(householdId)]);
  const filtered = Boolean(q || tag);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <Link href="/recipes/new" className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white">
          New recipe
        </Link>
      </div>

      <form action="/recipes" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by title or ingredient"
          aria-label="Search recipes"
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Search</button>
      </form>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {tags.map((t) => (
            <Link
              key={t}
              href={t === tag ? { pathname: "/recipes", query: q ? { q } : {} } : { pathname: "/recipes", query: { ...(q ? { q } : {}), tag: t } }}
              aria-current={t === tag ? "true" : undefined}
              className={`rounded-full border px-3 py-1 ${t === tag ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          {filtered ? (
            <>No recipes match. <Link className="underline" href="/recipes">Clear filters</Link></>
          ) : (
            <>No recipes yet. <Link className="underline" href="/recipes/new">Add your first one</Link>.</>
          )}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link href={`/recipes/${r.id}`} className="flex items-baseline justify-between gap-4 py-3">
                <span className="font-medium">{r.title}</span>
                <span className="shrink-0 text-sm text-zinc-500">
                  {r.servings} servings · {r._count.ingredients} ingredients
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRecipeAction } from "@/app/actions/recipes";
import { ConfirmButton } from "@/components/confirm-button";
import { requireHousehold } from "@/lib/dal";
import { formatQuantity } from "@/lib/quantity";
import { getRecipe } from "@/lib/recipe-service";

// Reads the session: blocks on the server (see authentication-with-cache-components guide).
export const instant = false;

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  const { householdId } = await requireHousehold();
  const { id } = await params;
  const recipe = await getRecipe(householdId, id);
  if (!recipe) notFound();

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">{recipe.title}</h1>
          <div className="flex shrink-0 items-center gap-4 text-sm">
            <Link href={`/recipes/${recipe.id}/edit`} className="underline">Edit</Link>
            <ConfirmButton action={deleteRecipeAction.bind(null, recipe.id)} label="Delete" message="Delete this recipe? It will also be removed from your meal plan. This can't be undone." />
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          {recipe.servings} servings
          {recipe.sourceUrl && (
            <>
              {" · "}
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Source</a>
            </>
          )}
        </p>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {recipe.tags.map((t) => (
              <Link key={t} href={{ pathname: "/recipes", query: { tag: t } }} className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">
                {t}
              </Link>
            ))}
          </div>
        )}
      </header>

      <section className="space-y-2">
        <h2 className="font-medium">Ingredients</h2>
        <ul className="list-disc space-y-1 pl-5">
          {recipe.ingredients.map((i) => (
            <li key={i.id}>
              {formatQuantity(i.quantity)} {i.unit} {i.name}
            </li>
          ))}
        </ul>
      </section>

      {recipe.instructions && (
        <section className="space-y-2">
          <h2 className="font-medium">Instructions</h2>
          <p className="whitespace-pre-wrap">{recipe.instructions}</p>
        </section>
      )}
    </article>
  );
}

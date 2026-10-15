import { notFound } from "next/navigation";
import { updateRecipeAction } from "@/app/actions/recipes";
import { RecipeForm } from "@/components/recipe-form";
import { requireHousehold } from "@/lib/dal";
import { formatQuantity } from "@/lib/quantity";
import { getRecipe } from "@/lib/recipe-service";

// Reads the session: blocks on the server (see authentication-with-cache-components guide).
export const instant = false;

export default async function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  const { householdId } = await requireHousehold();
  const { id } = await params;
  const recipe = await getRecipe(householdId, id);
  if (!recipe) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit recipe</h1>
      <RecipeForm
        action={updateRecipeAction.bind(null, recipe.id)}
        submitLabel="Save changes"
        initial={{
          title: recipe.title,
          servings: recipe.servings,
          sourceUrl: recipe.sourceUrl ?? "",
          tags: recipe.tags.join(", "),
          instructions: recipe.instructions,
          ingredients: recipe.ingredients.map((i) => ({ name: i.name, quantity: formatQuantity(i.quantity), unit: i.unit })),
        }}
      />
    </div>
  );
}

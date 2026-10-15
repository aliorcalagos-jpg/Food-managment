import { createRecipeAction } from "@/app/actions/recipes";
import { RecipeForm } from "@/components/recipe-form";

export default function NewRecipePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New recipe</h1>
      <RecipeForm
        action={createRecipeAction}
        submitLabel="Save recipe"
        initial={{ title: "", servings: 4, sourceUrl: "", tags: "", instructions: "", ingredients: [] }}
      />
    </div>
  );
}

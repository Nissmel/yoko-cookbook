import { useParams } from 'react-router-dom';
import { useRecipe } from '@/hooks/useRecipes';
import AppLayout from '@/components/AppLayout';
import RecipeForm from '@/components/RecipeForm';

export default function EditRecipe() {
  const { id } = useParams();
  const { data: recipe, isLoading } = useRecipe(id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="animate-pulse h-8 bg-muted rounded w-1/3" />
        </div>
      </AppLayout>
    );
  }

  if (!recipe) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center font-display text-2xl">
          Recipe not found
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <RecipeForm
        initialData={{
          id: recipe.id,
          title: recipe.title,
          description: recipe.description || '',
          servings: recipe.servings,
          prep_time_minutes: recipe.prep_time_minutes,
          cook_time_minutes: recipe.cook_time_minutes,
          category: recipe.category || '',
          tags: recipe.tags,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          image_url: recipe.image_url,
        }}
      />
    </AppLayout>
  );
}

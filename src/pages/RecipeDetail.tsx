import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRecipe, useDeleteRecipe } from '@/hooks/useRecipes';
import { useAddToShoppingList } from '@/hooks/useShoppingList';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Clock, Users, ShoppingCart, Pencil, Trash2, ArrowLeft, Minus, Plus, Share2, Flame, ExternalLink, ChefHat,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading } = useRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const addToList = useAddToShoppingList();
  const [scaledServings, setScaledServings] = useState<number | null>(null);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!recipe) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="font-display text-2xl">Recipe not found</h2>
          <Link to="/" className="text-primary hover:underline mt-4 inline-block">Go back</Link>
        </div>
      </AppLayout>
    );
  }

  const currentServings = scaledServings ?? recipe.servings;
  const scale = currentServings / recipe.servings;
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  const scaleQuantity = (qty: string) => {
    const num = parseFloat(qty);
    if (isNaN(num)) return qty;
    const scaled = Math.round(num * scale * 100) / 100;
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  };

  const handleAddToShoppingList = async () => {
    try {
      await addToList.mutateAsync(
        recipe.ingredients.map((ing) => ({
          ingredient_name: ing.name,
          quantity: scaleQuantity(ing.quantity),
          unit: ing.unit,
          recipe_id: recipe.id,
        }))
      );
      toast.success('Added to shopping list!');
    } catch {
      toast.error('Failed to add to list');
    }
  };

  const formatIngredientsText = () => {
    return recipe.ingredients
      .map((ing) => {
        const qty = ing.quantity ? scaleQuantity(ing.quantity) : '';
        return `${qty} ${ing.unit} ${ing.name}`.trim();
      })
      .join('\n');
  };

  const exportToGoogleKeep = () => {
    window.open('https://keep.google.com/#NOTE', '_blank');
    navigator.clipboard.writeText(formatIngredientsText()).then(() => {
      toast.success('Ingredients copied! Paste them into Google Keep.');
    }).catch(() => toast.error('Could not copy to clipboard'));
  };

  const handleDelete = async () => {
    try {
      await deleteRecipe.mutateAsync(recipe.id);
      toast.success('Recipe deleted');
      navigate('/');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const hasNutrition = recipe.calories_per_serving || recipe.protein_grams || recipe.carbs_grams || recipe.fat_grams || recipe.fiber_grams;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-muted-foreground -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {recipe.image_url && (
          <div className="rounded-2xl overflow-hidden aspect-video bg-muted">
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">{recipe.title}</h1>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" asChild>
                <Link to={`/edit/${recipe.id}`}><Pencil className="h-4 w-4" /></Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {recipe.description && (
            <p className="text-muted-foreground font-body text-lg">{recipe.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-body">
            {totalTime > 0 && (
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{totalTime} min</span>
            )}
            {recipe.category && <Badge variant="secondary">{recipe.category}</Badge>}
            {recipe.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>

          {(recipe as any).source_url && (
            <a
              href={(recipe as any).source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-body"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Source
            </a>
          )}
        </div>

        <Separator />

        {/* Servings scaler */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-sm font-body font-medium text-foreground">
            <Users className="h-4 w-4" /> Servings
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScaledServings(Math.max(1, currentServings - 1))}>
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number" min={1} value={currentServings}
              onChange={(e) => setScaledServings(Math.max(1, Number(e.target.value)))}
              className="w-16 text-center h-8"
            />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScaledServings(currentServings + 1)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {scaledServings && scaledServings !== recipe.servings && (
            <button onClick={() => setScaledServings(null)} className="text-xs text-primary hover:underline font-body">Reset</button>
          )}
        </div>

        {/* Ingredients */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display text-xl font-semibold">Ingredients</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToGoogleKeep} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Google Keep
              </Button>
              <Button variant="outline" size="sm" onClick={handleAddToShoppingList} className="gap-1.5">
                <ShoppingCart className="h-4 w-4" /> Add to List
              </Button>
            </div>
          </div>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2 text-foreground font-body py-1.5 border-b border-border/50 last:border-0">
                <span className="font-semibold text-primary min-w-[4rem] text-right">
                  {ing.quantity ? scaleQuantity(ing.quantity) : ''} {ing.unit}
                </span>
                <span>{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Nutrition */}
        {hasNutrition && (
          <>
            <div className="space-y-3">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" /> Nutrition
              </h2>

              {/* Per serving */}
              <p className="text-sm font-body text-muted-foreground">Per serving ({currentServings} servings)</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {recipe.calories_per_serving && (
                  <div className="rounded-xl bg-primary/10 p-3 text-center">
                    <div className="text-xl font-bold text-primary">{Math.round(recipe.calories_per_serving * scale)}</div>
                    <div className="text-xs text-muted-foreground font-body">kcal</div>
                  </div>
                )}
                {recipe.protein_grams && (
                  <div className="rounded-xl bg-secondary/10 p-3 text-center">
                    <div className="text-xl font-bold text-secondary">{(recipe.protein_grams * scale).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Protein (g)</div>
                  </div>
                )}
                {recipe.carbs_grams && (
                  <div className="rounded-xl bg-accent/30 p-3 text-center">
                    <div className="text-xl font-bold text-accent-foreground">{(recipe.carbs_grams * scale).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Carbs (g)</div>
                  </div>
                )}
                {recipe.fat_grams && (
                  <div className="rounded-xl bg-muted p-3 text-center">
                    <div className="text-xl font-bold text-foreground">{(recipe.fat_grams * scale).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Fat (g)</div>
                  </div>
                )}
                {recipe.fiber_grams && (
                  <div className="rounded-xl bg-secondary/10 p-3 text-center">
                    <div className="text-xl font-bold text-secondary">{(recipe.fiber_grams * scale).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Fiber (g)</div>
                  </div>
                )}
              </div>

              {/* Total for entire recipe */}
              <p className="text-sm font-body text-muted-foreground pt-2">Total for entire recipe</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {recipe.calories_per_serving && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
                    <div className="text-xl font-bold text-primary">{Math.round(recipe.calories_per_serving * currentServings)}</div>
                    <div className="text-xs text-muted-foreground font-body">kcal</div>
                  </div>
                )}
                {recipe.protein_grams && (
                  <div className="rounded-xl bg-secondary/5 border border-secondary/20 p-3 text-center">
                    <div className="text-xl font-bold text-secondary">{(recipe.protein_grams * currentServings).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Protein (g)</div>
                  </div>
                )}
                {recipe.carbs_grams && (
                  <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 text-center">
                    <div className="text-xl font-bold text-accent-foreground">{(recipe.carbs_grams * currentServings).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Carbs (g)</div>
                  </div>
                )}
                {recipe.fat_grams && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3 text-center">
                    <div className="text-xl font-bold text-foreground">{(recipe.fat_grams * currentServings).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Fat (g)</div>
                  </div>
                )}
                {recipe.fiber_grams && (
                  <div className="rounded-xl bg-secondary/5 border border-secondary/20 p-3 text-center">
                    <div className="text-xl font-bold text-secondary">{(recipe.fiber_grams * currentServings).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground font-body">Fiber (g)</div>
                  </div>
                )}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Instructions */}
        {recipe.instructions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Instructions</h2>
              <Button
                onClick={() => navigate(`/cooking/${recipe.id}`)}
                className="gap-1.5"
                size="sm"
              >
                <ChefHat className="h-4 w-4" /> Start Cooking
              </Button>
            </div>
            <ol className="space-y-4">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-4 font-body">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

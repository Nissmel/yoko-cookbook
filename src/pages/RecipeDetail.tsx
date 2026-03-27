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
  Clock, Users, ShoppingCart, Pencil, Trash2, ArrowLeft, Minus, Plus, Share2, Flame,
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
    const title = encodeURIComponent(recipe.title + ' — Ingredients');
    const body = encodeURIComponent(formatIngredientsText());
    window.open(`https://keep.google.com/#NOTE`, '_blank');
    // Google Keep doesn't support pre-filled URLs, so we copy to clipboard first
    navigator.clipboard.writeText(formatIngredientsText()).then(() => {
      toast.success('Ingredients copied! Paste them into Google Keep.');
    }).catch(() => {
      toast.error('Could not copy to clipboard');
    });
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
        </div>

        <Separator />

        {/* Servings scaler */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-sm font-body font-medium text-foreground">
            <Users className="h-4 w-4" /> Servings
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setScaledServings(Math.max(1, currentServings - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number" min={1} value={currentServings}
              onChange={(e) => setScaledServings(Math.max(1, Number(e.target.value)))}
              className="w-16 text-center h-8"
            />
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setScaledServings(currentServings + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {scaledServings && scaledServings !== recipe.servings && (
            <button onClick={() => setScaledServings(null)} className="text-xs text-primary hover:underline font-body">Reset</button>
          )}
        </div>

        {/* Ingredients */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Ingredients</h2>
            <Button variant="outline" size="sm" onClick={handleAddToShoppingList} className="gap-1.5">
              <ShoppingCart className="h-4 w-4" /> Add to List
            </Button>
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

        {/* Instructions */}
        {recipe.instructions.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Instructions</h2>
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

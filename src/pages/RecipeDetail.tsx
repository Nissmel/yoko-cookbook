import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRecipe, useDeleteRecipe, useUpdateRecipe } from '@/hooks/useRecipes';
import { useAddToShoppingList } from '@/hooks/useShoppingList';
import { useCollections, useAddToCollection, useRemoveFromCollection } from '@/hooks/useCollections';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Clock, Users, ShoppingCart, Pencil, Trash2, ArrowLeft, Minus, Plus, Share2, Flame, ExternalLink, ChefHat,
  FolderPlus, Check, X, MessageCircle, Send, Loader2, Sparkles, AlertTriangle,
} from 'lucide-react';
import { CATEGORIES } from '@/types/recipe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';

function CollectionPicker({ recipeId }: { recipeId: string }) {
  const { data: collections } = useCollections();
  const addToCollection = useAddToCollection();
  const removeFromCollection = useRemoveFromCollection();

  // Check which collections contain this recipe
  const { data: memberships, refetch } = useQuery({
    queryKey: ['recipe-memberships', recipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_collection_items')
        .select('collection_id')
        .eq('recipe_id', recipeId);
      if (error) throw error;
      return new Set(data.map((d: any) => d.collection_id));
    },
  });

  const toggle = async (collectionId: string) => {
    try {
      if (memberships?.has(collectionId)) {
        await removeFromCollection.mutateAsync({ collectionId, recipeId });
        toast.success('Removed from collection');
      } else {
        await addToCollection.mutateAsync({ collectionId, recipeId });
        toast.success('Added to collection');
      }
      refetch();
    } catch {
      toast.error('Failed to update collection');
    }
  };

  if (!collections?.length) {
    return <p className="text-sm text-muted-foreground py-4">No collections yet. Create one in the Collections page first.</p>;
  }

  return (
    <div className="space-y-1 pt-2">
      {collections.map((col) => {
        const isMember = memberships?.has(col.id);
        return (
          <button
            key={col.id}
            onClick={() => toggle(col.id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-body transition-colors ${
              isMember ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
          >
            <span>{col.name}</span>
            {isMember ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

function RecipeAIChat({ recipe }: { recipe: any }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    'What can I substitute for the main ingredient?',
    'How can I make this healthier?',
    'What goes well as a side dish?',
    'Can I prepare this ahead of time?',
  ];

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setMessage('');
    setChat((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('recipe-chat', {
        body: { message: userMsg, recipe },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setChat((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch (e: any) {
      toast.error(e.message || 'AI request failed');
      setChat((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs">
          <Sparkles className="h-3.5 w-3.5" /> Ask AI
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Recipe Assistant
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px] max-h-[400px] py-2">
          {chat.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-body">Ask anything about this recipe:</p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 font-body transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.map((msg, i) => (
            <div
              key={i}
              className={`text-sm font-body rounded-2xl px-3 py-2.5 whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-8 bg-muted rounded-2xl px-3 py-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-border/50">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about this recipe..."
            className="min-h-[44px] max-h-[100px] rounded-xl text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(message);
              }
            }}
          />
          <Button
            size="icon"
            className="rounded-xl shrink-0 h-[44px] w-[44px]"
            onClick={() => send(message)}
            disabled={!message.trim() || loading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading } = useRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const updateRecipe = useUpdateRecipe();
  const addToList = useAddToShoppingList();
  const [scaledServings, setScaledServings] = useState<number | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string>('');

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded-xl w-1/2" />
            <div className="h-64 bg-muted rounded-2xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!recipe) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="font-display text-2xl font-bold">Recipe not found</h2>
          <Link to="/" className="text-primary hover:underline mt-4 inline-block font-body">Go back</Link>
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

  const enrichInstruction = (step: string) => {
    let enriched = step;
    recipe.ingredients.forEach((ing) => {
      if (!ing.name) return;
      const namePattern = new RegExp(`\\b${ing.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (namePattern.test(enriched)) {
        const qty = ing.quantity ? scaleQuantity(ing.quantity) : '';
        const unit = ing.unit || '';
        const prefix = `${qty}${unit ? ' ' + unit : ''}`.trim();
        if (prefix) {
          enriched = enriched.replace(namePattern, `${prefix} ${ing.name}`);
        }
      }
    });
    return enriched;
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
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-muted-foreground -ml-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Category missing banner */}
        {!recipe.category && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-body text-destructive font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This recipe has no category.
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Select value={pendingCategory} onValueChange={setPendingCategory}>
                <SelectTrigger className="w-[160px] h-9 rounded-xl text-sm">
                  <SelectValue placeholder="Pick category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="rounded-xl"
                disabled={!pendingCategory || updateRecipe.isPending}
                onClick={async () => {
                  try {
                    await updateRecipe.mutateAsync({ id: recipe.id, category: pendingCategory });
                    toast.success('Category saved!');
                    setPendingCategory('');
                  } catch {
                    toast.error('Failed to save category');
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Hero image */}
        {recipe.image_url && (
          <div className="rounded-3xl overflow-hidden aspect-[16/9] bg-muted shadow-sm">
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Title & meta */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
              {recipe.title}
            </h1>
            <div className="flex gap-1 shrink-0">
              {/* Collection picker */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl" title="Add to collection">
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="font-display">Add to Collection</DialogTitle>
                  </DialogHeader>
                  <CollectionPicker recipeId={recipe.id} />
                </DialogContent>
              </Dialog>

              <Button variant="ghost" size="icon" className="rounded-xl" asChild>
                <Link to={`/edit/${recipe.id}`}><Pencil className="h-4 w-4" /></Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">Delete this recipe?</AlertDialogTitle>
                    <AlertDialogDescription className="font-body">This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {recipe.description && (
            <p className="text-muted-foreground font-body text-base leading-relaxed">{recipe.description}</p>
          )}

          {/* Quick stats pills */}
          <div className="flex flex-wrap items-center gap-2">
            {totalTime > 0 && (
              <div className="flex items-center gap-1.5 bg-card rounded-full px-3 py-1.5 text-sm font-body border border-border/50">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>{totalTime} min</span>
              </div>
            )}
            {recipe.category && (
              <div className="bg-primary/10 text-primary rounded-full px-3 py-1.5 text-sm font-body font-medium">
                {recipe.category}
              </div>
            )}
            {recipe.tags.map((t) => (
              <span key={t} className="bg-muted/70 text-muted-foreground rounded-full px-3 py-1.5 text-xs font-body">
                {t}
              </span>
            ))}
          </div>

          {(recipe as any).source_url && (
            <a
              href={(recipe as any).source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-body"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View source
            </a>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Servings scaler */}
        <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/50">
          <span className="flex items-center gap-2 text-sm font-body font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" /> Servings
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setScaledServings(Math.max(1, currentServings - 1))}>
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              type="number" min={1} value={currentServings}
              onChange={(e) => setScaledServings(Math.max(1, Number(e.target.value)))}
              className="w-16 text-center h-9 rounded-xl font-body font-semibold"
            />
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setScaledServings(currentServings + 1)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {scaledServings && scaledServings !== recipe.servings && (
            <button onClick={() => setScaledServings(null)} className="text-xs text-primary hover:underline font-body ml-auto">Reset</button>
          )}
        </div>

        {/* Ingredients */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display text-xl font-bold">Ingredients</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToGoogleKeep} className="gap-1.5 rounded-xl text-xs">
                <Share2 className="h-3.5 w-3.5" /> Keep
              </Button>
              <Button variant="outline" size="sm" onClick={handleAddToShoppingList} className="gap-1.5 rounded-xl text-xs">
                <ShoppingCart className="h-3.5 w-3.5" /> Add to List
              </Button>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 divide-y divide-border/40 overflow-hidden">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-3 px-4 py-3 font-body">
                <span className="font-bold text-primary min-w-[4.5rem] text-right text-sm">
                  {ing.quantity ? scaleQuantity(ing.quantity) : ''} {ing.unit}
                </span>
                <span className="text-foreground text-sm">{ing.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nutrition */}
        {hasNutrition && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" /> Nutrition
            </h2>

            <p className="text-sm font-body text-muted-foreground">Per serving</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {recipe.calories_per_serving && (
                <div className="rounded-2xl bg-primary/10 p-3.5 text-center">
                  <div className="text-xl font-bold text-primary font-display">{recipe.calories_per_serving}</div>
                  <div className="text-xs text-muted-foreground font-body">kcal</div>
                </div>
              )}
              {recipe.protein_grams && (
                <div className="rounded-2xl bg-secondary/10 p-3.5 text-center">
                  <div className="text-xl font-bold text-secondary font-display">{recipe.protein_grams}</div>
                  <div className="text-xs text-muted-foreground font-body">Protein</div>
                </div>
              )}
              {recipe.carbs_grams && (
                <div className="rounded-2xl bg-accent/40 p-3.5 text-center">
                  <div className="text-xl font-bold text-accent-foreground font-display">{recipe.carbs_grams}</div>
                  <div className="text-xs text-muted-foreground font-body">Carbs</div>
                </div>
              )}
              {recipe.fat_grams && (
                <div className="rounded-2xl bg-muted p-3.5 text-center">
                  <div className="text-xl font-bold text-foreground font-display">{recipe.fat_grams}</div>
                  <div className="text-xs text-muted-foreground font-body">Fat</div>
                </div>
              )}
              {recipe.fiber_grams && (
                <div className="rounded-2xl bg-secondary/10 p-3.5 text-center">
                  <div className="text-xl font-bold text-secondary font-display">{recipe.fiber_grams}</div>
                  <div className="text-xs text-muted-foreground font-body">Fiber</div>
                </div>
              )}
            </div>

            <p className="text-sm font-body text-muted-foreground pt-1">Total for {currentServings} servings</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {recipe.calories_per_serving && (
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3.5 text-center">
                  <div className="text-xl font-bold text-primary font-display">{Math.round(recipe.calories_per_serving * currentServings)}</div>
                  <div className="text-xs text-muted-foreground font-body">kcal</div>
                </div>
              )}
              {recipe.protein_grams && (
                <div className="rounded-2xl bg-secondary/5 border border-secondary/20 p-3.5 text-center">
                  <div className="text-xl font-bold text-secondary font-display">{(recipe.protein_grams * currentServings).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground font-body">Protein</div>
                </div>
              )}
              {recipe.carbs_grams && (
                <div className="rounded-2xl bg-accent/10 border border-accent/20 p-3.5 text-center">
                  <div className="text-xl font-bold text-accent-foreground font-display">{(recipe.carbs_grams * currentServings).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground font-body">Carbs</div>
                </div>
              )}
              {recipe.fat_grams && (
                <div className="rounded-2xl bg-muted/50 border border-border p-3.5 text-center">
                  <div className="text-xl font-bold text-foreground font-display">{(recipe.fat_grams * currentServings).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground font-body">Fat</div>
                </div>
              )}
              {recipe.fiber_grams && (
                <div className="rounded-2xl bg-secondary/5 border border-secondary/20 p-3.5 text-center">
                  <div className="text-xl font-bold text-secondary font-display">{(recipe.fiber_grams * currentServings).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground font-body">Fiber</div>
                </div>
              )}
            </div>

            <div className="h-px bg-border/60" />
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-display text-xl font-bold">Instructions</h2>
              <div className="flex gap-2">
                <RecipeAIChat recipe={recipe} />
                <Button
                  onClick={() => navigate(`/cooking/${recipe.id}`)}
                  className="gap-1.5 rounded-xl shadow-sm"
                  size="sm"
                >
                  <ChefHat className="h-4 w-4" /> Start Cooking
                </Button>
              </div>
            </div>
            <ol className="space-y-5">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-4 font-body">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed text-foreground text-[15px]">{enrichInstruction(step)}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

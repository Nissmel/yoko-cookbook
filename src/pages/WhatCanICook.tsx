import { useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useRecipes } from '@/hooks/useRecipes';
import { usePantryItems } from '@/hooks/usePantry';
import { Link } from 'react-router-dom';
import { ChefHat, Check, X, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function normalizeIngredient(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[ąà]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęè]/g, 'e')
    .replace(/[łl]/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óò]/g, 'o')
    .replace(/[śš]/g, 's').replace(/[źżž]/g, 'z');
}

function ingredientMatch(pantryName: string, recipeName: string): boolean {
  const p = normalizeIngredient(pantryName);
  const r = normalizeIngredient(recipeName);
  return r.includes(p) || p.includes(r);
}

export default function WhatCanICook() {
  const { data: recipes, isLoading: recipesLoading } = useRecipes();
  const { data: pantry, isLoading: pantryLoading } = usePantryItems();

  const results = useMemo(() => {
    if (!recipes || !pantry) return [];

    const pantryNames = pantry.map((p) => p.name);

    return recipes
      .map((recipe) => {
        const matched: string[] = [];
        const missing: string[] = [];

        recipe.ingredients.forEach((ing) => {
          const found = pantryNames.some((pn) => ingredientMatch(pn, ing.name));
          if (found) matched.push(ing.name);
          else missing.push(ing.name);
        });

        const total = recipe.ingredients.length;
        const matchPercent = total > 0 ? Math.round((matched.length / total) * 100) : 0;

        return { recipe, matched, missing, matchPercent };
      })
      .filter((r) => r.matchPercent > 0)
      .sort((a, b) => b.matchPercent - a.matchPercent);
  }, [recipes, pantry]);

  const isLoading = recipesLoading || pantryLoading;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-primary" />
            What Can I Cook?
          </h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Recipes ranked by ingredients you already have in your pantry.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !pantry?.length ? (
          <div className="text-center py-16 space-y-3">
            <Package className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="font-body text-muted-foreground">Your pantry is empty. Add items first!</p>
            <Link to="/pantry" className="text-primary hover:underline font-body text-sm">
              Go to Pantry →
            </Link>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-body text-muted-foreground">No recipe matches found. Try adding more items to your pantry.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(({ recipe, matched, missing, matchPercent }) => (
              <Link
                key={recipe.id}
                to={`/recipe/${recipe.id}`}
                className="block bg-card rounded-2xl border border-border/50 p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {recipe.image_url && (
                    <img
                      src={recipe.image_url}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-foreground truncate">{recipe.title}</h3>
                      <Badge
                        variant={matchPercent === 100 ? 'default' : 'secondary'}
                        className="shrink-0 rounded-full"
                      >
                        {matchPercent}% match
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      {matched.slice(0, 5).map((m) => (
                        <span key={m} className="inline-flex items-center gap-0.5 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-body">
                          <Check className="h-2.5 w-2.5" /> {m}
                        </span>
                      ))}
                      {missing.slice(0, 3).map((m) => (
                        <span key={m} className="inline-flex items-center gap-0.5 text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5 font-body">
                          <X className="h-2.5 w-2.5" /> {m}
                        </span>
                      ))}
                      {matched.length + missing.length > 8 && (
                        <span className="text-xs text-muted-foreground font-body">
                          +{matched.length + missing.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

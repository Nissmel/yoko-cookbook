import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ChefHat, Sparkles, X, Plus, Loader2, Clock, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { usePantryItems } from '@/hooks/usePantry';

interface MatchedRecipe {
  id: string;
  title: string;
  image_url: string | null;
  category: string | null;
  matched: string[];
  missing: string[];
  missingCount: number;
  matchPercent: number;
}

interface AIIdea {
  title: string;
  description: string;
  usedIngredients: string[];
  missingIngredients: string[];
  timeMinutes: number;
  difficulty: string;
}

const QUICK_SUGGESTIONS = ['Jajka', 'Mąka', 'Mleko', 'Masło', 'Cebula', 'Czosnek', 'Pomidor', 'Kurczak', 'Ryż', 'Makaron'];

export default function WhatCanICook() {
  const { data: pantry } = usePantryItems();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ matchedRecipes: MatchedRecipe[]; ideas: AIIdea[] } | null>(null);

  const addIngredient = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (ingredients.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return;
    setIngredients([...ingredients, trimmed]);
    setInput('');
  };

  const removeIngredient = (name: string) => {
    setIngredients(ingredients.filter((i) => i !== name));
  };

  const loadFromPantry = () => {
    if (!pantry?.length) {
      toast.info('Your pantry is empty. Add items there first.');
      return;
    }
    const merged = [...new Set([...ingredients, ...pantry.map((p) => p.name)])];
    setIngredients(merged);
    toast.success(`Loaded ${pantry.length} items from pantry`);
  };

  const handleSearch = async () => {
    if (ingredients.length === 0) {
      toast.error('Add at least one ingredient');
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('cook-suggestions', {
        body: { ingredients },
      });
      if (error) {
        const msg = (error as any)?.message || 'Failed to get suggestions';
        if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
          toast.error('Rate limit exceeded — try again in a moment');
        } else if (msg.includes('402')) {
          toast.error('AI credits exhausted', { description: 'Add credits in workspace settings' });
        } else {
          toast.error(msg);
        }
        return;
      }
      setResults(data);
      const total = (data.matchedRecipes?.length ?? 0) + (data.ideas?.length ?? 0);
      if (total === 0) {
        toast.info('No suggestions found — try different ingredients');
      } else {
        toast.success(`Found ${total} ideas!`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-primary" />
            What Can I Cook?
          </h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Wpisz składniki, które masz — znajdziemy pasujące przepisy z Twojej książki + AI zaproponuje nowe pomysły.
          </p>
        </div>

        {/* Input card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="font-display text-lg">Your ingredients ({ingredients.length})</CardTitle>
              <Button onClick={loadFromPantry} variant="outline" size="sm" disabled={!pantry?.length} className="gap-1.5">
                <Package className="h-4 w-4" /> Load from pantry
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Np. jajka, mąka, masło"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient(input))}
              />
              <Button onClick={() => addIngredient(input)} disabled={!input.trim()} className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            {ingredients.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ing) => (
                  <Badge key={ing} variant="secondary" className="font-body gap-1.5 pr-1.5 py-1">
                    {ing}
                    <button onClick={() => removeIngredient(ing)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-body">Quick add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => addIngredient(s)}
                      className="text-xs font-body px-2.5 py-1 rounded-full bg-muted hover:bg-accent transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleSearch} disabled={loading || ingredients.length === 0} className="w-full gap-2" size="lg">
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Szukam pomysłów...</>
              ) : (
                <><Sparkles className="h-5 w-5" /> Find recipes & AI ideas</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Matched recipes from user's book */}
            {results.matchedRecipes.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-primary" /> From your recipes
                </h2>
                {results.matchedRecipes.map((r) => (
                  <Link key={r.id} to={`/recipe/${r.id}`} className="block">
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {r.image_url && (
                            <img src={r.image_url} alt={r.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-display font-semibold truncate">{r.title}</h3>
                              <span className={`text-sm font-bold shrink-0 ${r.matchPercent >= 80 ? 'text-secondary' : r.matchPercent >= 50 ? 'text-primary' : 'text-muted-foreground'}`}>
                                {r.matchPercent}%
                              </span>
                            </div>
                            <Progress value={r.matchPercent} className="h-2 mt-1.5" />
                            {r.missing.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {r.missing.slice(0, 5).map((m, i) => (
                                  <Badge key={i} variant="outline" className="text-xs font-body text-destructive border-destructive/30">{m}</Badge>
                                ))}
                                {r.missingCount > 5 && (
                                  <Badge variant="outline" className="text-xs font-body">+{r.missingCount - 5} more</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* AI new ideas */}
            {results.ideas.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> AI new ideas
                </h2>
                {results.ideas.map((idea, i) => (
                  <Card key={i} className="border-primary/20">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-semibold text-lg">{idea.title}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-xs font-body gap-1">
                            <Clock className="h-3 w-3" /> {idea.timeMinutes}m
                          </Badge>
                          <Badge variant="secondary" className="text-xs font-body">{idea.difficulty}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground font-body">{idea.description}</p>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground font-body mr-1">Z Twoich:</span>
                          {idea.usedIngredients.map((u, j) => (
                            <Badge key={j} variant="outline" className="text-xs font-body bg-primary/5 border-primary/30 text-primary">{u}</Badge>
                          ))}
                        </div>
                        {idea.missingIngredients.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground font-body mr-1">Brakuje:</span>
                            {idea.missingIngredients.map((m, j) => (
                              <Badge key={j} variant="outline" className="text-xs font-body text-destructive border-destructive/30">{m}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {results.matchedRecipes.length === 0 && results.ideas.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-body">
                No suggestions found. Try different ingredients.
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

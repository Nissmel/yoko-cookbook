import { useState, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { useRecipes } from '@/hooks/useRecipes';
import { usePantryItems, useAddPantryItems, useDeletePantryItem, useClearPantry } from '@/hooks/usePantry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package, ChefHat, FileJson, ClipboardPaste, Plus, X, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecipeMatch {
  recipeId: string;
  title: string;
  image_url: string | null;
  category: string | null;
  matchPercentage: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

export default function Pantry() {
  const { data: recipes } = useRecipes();
  const { data: pantryItems, isLoading: pantryLoading } = usePantryItems();
  const addPantryItems = useAddPantryItems();
  const deletePantryItem = useDeletePantryItem();
  const clearPantry = useClearPantry();
  const [matches, setMatches] = useState<RecipeMatch[]>([]);
  const [jsonText, setJsonText] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const addItemsFromJson = (parsed: any) => {
    const items: { name: string; quantity?: string; unit?: string }[] = [];
    const arr = Array.isArray(parsed) ? parsed : parsed.items || [];
    for (const i of arr) {
      if (typeof i === 'string') items.push({ name: i });
      else if (i.name) items.push({ name: i.name, quantity: i.quantity, unit: i.unit });
    }
    if (items.length === 0) { toast.error('No items found'); return; }
    addPantryItems.mutate(items, { onSuccess: () => toast.success(`Added ${items.length} items`) });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { addItemsFromJson(JSON.parse(ev.target?.result as string)); }
      catch { toast.error('Invalid JSON file'); }
    };
    reader.readAsText(file);
  };

  const handlePasteJson = () => {
    if (!jsonText.trim()) return;
    try { addItemsFromJson(JSON.parse(jsonText)); setJsonText(''); }
    catch { toast.error('Invalid JSON'); }
  };

  const handleAddSingle = () => {
    if (!newItemName.trim()) return;
    addPantryItems.mutate([{ name: newItemName.trim() }], {
      onSuccess: () => { setNewItemName(''); toast.success('Added!'); },
    });
  };

  const calculateMatches = () => {
    if (!recipes?.length) { toast.error('No recipes to match against'); return; }
    if (!pantryItems?.length) { toast.error('Add items to your pantry first'); return; }

    const pantryNames = pantryItems.map((i) => i.name.toLowerCase().trim());

    const results: RecipeMatch[] = recipes.map((recipe) => {
      const matched: string[] = [];
      const missing: string[] = [];
      recipe.ingredients.forEach((ing) => {
        const ingName = ing.name.toLowerCase().trim();
        const isMatch = pantryNames.some((p) => p.includes(ingName) || ingName.includes(p));
        if (isMatch) matched.push(ing.name);
        else missing.push(ing.name);
      });
      const total = recipe.ingredients.length;
      const pct = total > 0 ? Math.round((matched.length / total) * 100) : 0;
      return { recipeId: recipe.id, title: recipe.title, image_url: recipe.image_url, category: recipe.category, matchPercentage: pct, matchedIngredients: matched, missingIngredients: missing };
    });
    results.sort((a, b) => b.matchPercentage - a.matchPercentage);
    setMatches(results);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Pantry</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Manage what's in your kitchen and find recipes you can make.
          </p>
        </div>

        {/* Add single item */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex gap-2">
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add item (e.g. Eggs)"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
              <Button onClick={handleAddSingle} disabled={!newItemName.trim()} className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk import */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Package className="h-5 w-5" /> Bulk Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="gap-1.5"><ClipboardPaste className="h-4 w-4" /> Paste JSON</TabsTrigger>
                <TabsTrigger value="file" className="gap-1.5"><FileJson className="h-4 w-4" /> Upload File</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="mt-3 space-y-3">
                <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='["Eggs", "Milk", "Butter"]' rows={4} className="font-mono text-sm" />
                <Button onClick={handlePasteJson} disabled={!jsonText.trim()} className="w-full gap-1.5">
                  <ClipboardPaste className="h-4 w-4" /> Import Items
                </Button>
              </TabsContent>
              <TabsContent value="file" className="mt-3">
                <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-1.5">
                  <FileJson className="h-4 w-4" /> Upload JSON
                </Button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Current pantry items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">Your Pantry ({pantryItems?.length ?? 0})</CardTitle>
              {pantryItems && pantryItems.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => clearPantry.mutate()} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pantryLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
            ) : pantryItems && pantryItems.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pantryItems.map((item) => (
                  <Badge key={item.id} variant="secondary" className="font-body gap-1.5 pr-1.5 py-1">
                    {item.name}
                    {item.quantity && <span className="text-muted-foreground">({item.quantity}{item.unit ? ` ${item.unit}` : ''})</span>}
                    <button onClick={() => deletePantryItem.mutate(item.id)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm font-body">No items yet. Add items above.</p>
            )}
          </CardContent>
        </Card>

        {/* Match recipes button */}
        <Button onClick={calculateMatches} className="w-full gap-2" size="lg" disabled={!pantryItems?.length}>
          <ChefHat className="h-5 w-5" /> Find Matching Recipes
        </Button>

        {/* Results */}
        {matches.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" /> Recipe Suggestions
            </h2>
            {matches.map((match) => (
              <Link key={match.recipeId} to={`/recipe/${match.recipeId}`} className="block">
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {match.image_url && (
                        <img src={match.image_url} alt={match.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display font-semibold truncate">{match.title}</h3>
                          <span className={`text-sm font-bold shrink-0 ${match.matchPercentage >= 80 ? 'text-secondary' : match.matchPercentage >= 50 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {match.matchPercentage}%
                          </span>
                        </div>
                        <Progress value={match.matchPercentage} className="h-2 mt-1.5" />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {match.missingIngredients.slice(0, 5).map((m, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-body text-destructive border-destructive/30">{m}</Badge>
                          ))}
                          {match.missingIngredients.length > 5 && (
                            <Badge variant="outline" className="text-xs font-body">+{match.missingIngredients.length - 5} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

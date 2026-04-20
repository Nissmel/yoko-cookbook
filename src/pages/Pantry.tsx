import { useState, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { useRecipes } from '@/hooks/useRecipes';
import { usePantryItems, useAddPantryItems, useDeletePantryItem, useClearPantry } from '@/hooks/usePantry';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package, ChefHat, FileJson, ClipboardPaste, Plus, X, Trash2, Copy, Sparkles, Download, Replace, Loader2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const AI_PROMPT_TEMPLATE = `Wygeneruj listę produktów spiżarni w formacie JSON. Użyj poniższego schematu i języka polskiego. Zwróć WYŁĄCZNIE poprawny JSON, bez markdownu i bez komentarzy.

Schemat:
[
  { "name": "Jajka", "quantity": "10", "unit": "szt" },
  { "name": "Mleko", "quantity": "1", "unit": "l" },
  { "name": "Masło", "quantity": "200", "unit": "g" },
  { "name": "Mąka pszenna" }
]

Zasady:
- "name" jest wymagane (po polsku, mianownik, liczba pojedyncza gdy to możliwe).
- "quantity" i "unit" są opcjonalne.
- Jednostki tylko metryczne: g, kg, ml, l, szt, łyżka, łyżeczka, szklanka.
- Możesz też zwrócić prostą tablicę nazw, np. ["Jajka", "Mleko", "Masło"].`;

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
  const [overwriteMode, setOverwriteMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addItemsFromJson = (parsed: any) => {
    const items: { name: string; quantity?: string; unit?: string }[] = [];
    const arr = Array.isArray(parsed) ? parsed : parsed.items || [];
    for (const i of arr) {
      if (typeof i === 'string') items.push({ name: i });
      else if (i.name) items.push({ name: i.name, quantity: i.quantity, unit: i.unit });
    }
    if (items.length === 0) { toast.error('No items found'); return; }

    const doImport = () => {
      addPantryItems.mutate(items, {
        onSuccess: () => toast.success(overwriteMode ? `Replaced pantry with ${items.length} items` : `Added ${items.length} items`),
      });
    };

    if (overwriteMode && pantryItems && pantryItems.length > 0) {
      clearPantry.mutate(undefined, { onSuccess: doImport });
    } else {
      doImport();
    }
  };

  const handleExportJson = async () => {
    if (!pantryItems?.length) { toast.error('Pantry is empty'); return; }
    const exportData = pantryItems.map((i) => {
      const obj: { name: string; quantity?: string; unit?: string } = { name: i.name };
      if (i.quantity) obj.quantity = i.quantity;
      if (i.unit) obj.unit = i.unit;
      return obj;
    });
    const json = JSON.stringify(exportData, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast.success(`Copied ${exportData.length} items as JSON`);
    } catch {
      setJsonText(json);
      toast.success('JSON loaded into paste field');
    }
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
            Manage what you have in the kitchen and find recipes to cook.
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Package className="h-5 w-5" /> Bulk Import
              </CardTitle>
              <Button
                onClick={handleExportJson}
                variant="outline"
                size="sm"
                disabled={!pantryItems?.length}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" /> Export current
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Replace className={`h-4 w-4 shrink-0 ${overwriteMode ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="min-w-0">
                  <Label htmlFor="overwrite-mode" className="font-body text-sm cursor-pointer">
                    {overwriteMode ? 'Overwrite mode: ON' : 'Overwrite mode: OFF'}
                  </Label>
                  <p className="text-xs text-muted-foreground font-body">
                    {overwriteMode
                      ? 'Next import will DELETE current pantry and replace it with JSON contents'
                      : 'Next import will ADD items on top of your current pantry'}
                  </p>
                </div>
              </div>
              <Switch id="overwrite-mode" checked={overwriteMode} onCheckedChange={setOverwriteMode} />
            </div>
            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="paste" className="gap-1.5"><ClipboardPaste className="h-4 w-4" /> Paste JSON</TabsTrigger>
                <TabsTrigger value="file" className="gap-1.5"><FileJson className="h-4 w-4" /> Upload File</TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-4 w-4" /> AI Prompt</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="mt-3 space-y-3">
                <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='["Jajka", "Mleko", "Masło"]' rows={4} className="font-mono text-sm" />
                <Button onClick={handlePasteJson} disabled={!jsonText.trim()} className="w-full gap-1.5">
                  {overwriteMode ? <><Replace className="h-4 w-4" /> Replace Pantry</> : <><ClipboardPaste className="h-4 w-4" /> Import Items</>}
                </Button>
              </TabsContent>
              <TabsContent value="file" className="mt-3">
                <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-1.5">
                  <FileJson className="h-4 w-4" /> Upload JSON
                </Button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </TabsContent>
              <TabsContent value="ai" className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground font-body">
                  Skopiuj poniższy prompt i wklej go do dowolnego asystenta AI (ChatGPT, Claude, Gemini). Następnie skopiuj otrzymany JSON i wklej w zakładce "Paste JSON".
                </p>
                <Textarea value={AI_PROMPT_TEMPLATE} readOnly rows={10} className="font-mono text-xs bg-muted/40" />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
                    toast.success('Prompt copied to clipboard');
                  }}
                  variant="outline"
                  className="w-full gap-1.5"
                >
                  <Copy className="h-4 w-4" /> Copy AI Prompt
                </Button>
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
                  <Trash2 className="h-4 w-4" /> Clear All
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
              <p className="text-muted-foreground text-sm font-body">No items yet. Add some above.</p>
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

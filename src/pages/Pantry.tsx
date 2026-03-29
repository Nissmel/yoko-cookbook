import { useState, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { useRecipes } from '@/hooks/useRecipes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Package, ChefHat, FileJson, ClipboardPaste } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PantryItem {
  name: string;
  quantity?: string;
  unit?: string;
}

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
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [matches, setMatches] = useState<RecipeMatch[]>([]);
  const [jsonText, setJsonText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const processPantryData = (parsed: any) => {
    const items: PantryItem[] = Array.isArray(parsed)
      ? parsed.map((i: any) =>
          typeof i === 'string' ? { name: i } : { name: i.name || '', quantity: i.quantity, unit: i.unit }
        )
      : parsed.items
      ? parsed.items.map((i: any) =>
          typeof i === 'string' ? { name: i } : { name: i.name || '', quantity: i.quantity, unit: i.unit }
        )
      : [];

    if (items.length === 0) {
      toast.error('No items found');
      return;
    }

    setPantryItems(items);
    calculateMatches(items);
    toast.success(`Loaded ${items.length} pantry items`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        processPantryData(JSON.parse(ev.target?.result as string));
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteJson = () => {
    if (!jsonText.trim()) return;
    try {
      processPantryData(JSON.parse(jsonText));
    } catch {
      toast.error('Invalid JSON');
    }
  };

  const calculateMatches = (items: PantryItem[]) => {
    if (!recipes?.length) {
      toast.error('No recipes to match against');
      return;
    }

    const pantryNames = items.map((i) => i.name.toLowerCase().trim());

    const results: RecipeMatch[] = recipes.map((recipe) => {
      const matched: string[] = [];
      const missing: string[] = [];

      recipe.ingredients.forEach((ing) => {
        const ingName = ing.name.toLowerCase().trim();
        const isMatch = pantryNames.some(
          (p) => p.includes(ingName) || ingName.includes(p)
        );
        if (isMatch) matched.push(ing.name);
        else missing.push(ing.name);
      });

      const total = recipe.ingredients.length;
      const pct = total > 0 ? Math.round((matched.length / total) * 100) : 0;

      return {
        recipeId: recipe.id,
        title: recipe.title,
        image_url: recipe.image_url,
        category: recipe.category,
        matchPercentage: pct,
        matchedIngredients: matched,
        missingIngredients: missing,
      };
    });

    results.sort((a, b) => b.matchPercentage - a.matchPercentage);
    setMatches(results);
  };

  const pantryTemplate = JSON.stringify(
    ["Eggs", "Milk", "Butter", "Flour", "Sugar", "Salt", "Pepper", "Olive oil", "Garlic", "Onion"],
    null,
    2
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Pantry Match</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Upload or paste what's in your pantry and find the best recipes to make.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Package className="h-5 w-5" /> Your Pantry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground font-body">
              Provide a JSON array of your pantry items — simple strings or objects with name/quantity/unit.
            </p>
            <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto max-h-32 text-foreground">
              {pantryTemplate}
            </pre>

            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="gap-1.5"><ClipboardPaste className="h-4 w-4" /> Paste JSON</TabsTrigger>
                <TabsTrigger value="file" className="gap-1.5"><FileJson className="h-4 w-4" /> Upload File</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-3 space-y-3">
                <Textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='["Eggs", "Milk", "Butter", "Flour"]'
                  rows={5}
                  className="font-mono text-sm"
                />
                <Button onClick={handlePasteJson} disabled={!jsonText.trim()} className="w-full gap-1.5">
                  <ClipboardPaste className="h-4 w-4" /> Match Recipes
                </Button>
              </TabsContent>

              <TabsContent value="file" className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pantryTemplate);
                      toast.success('Template copied!');
                    }}
                    className="gap-1.5"
                  >
                    Copy Template
                  </Button>
                  <Button onClick={() => fileRef.current?.click()} className="gap-1.5">
                    <Upload className="h-4 w-4" /> Upload Pantry
                  </Button>
                  <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </div>
              </TabsContent>
            </Tabs>

            {pantryItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {pantryItems.map((item, i) => (
                  <Badge key={i} variant="secondary" className="font-body">{item.name}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                          <span className={`text-sm font-bold shrink-0 ${match.matchPercentage >= 80 ? 'text-green-600' : match.matchPercentage >= 50 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                            {match.matchPercentage}%
                          </span>
                        </div>
                        <Progress value={match.matchPercentage} className="h-2 mt-1.5" />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {match.missingIngredients.slice(0, 5).map((m, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-body text-destructive border-destructive/30">
                              {m}
                            </Badge>
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

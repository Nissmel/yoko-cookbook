import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateRecipe } from '@/hooks/useRecipes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileJson, Globe, Copy, Loader2 } from 'lucide-react';

const AI_INSTRUCTIONS = `## Instructions for AI
Fill in the JSON template below with recipe data. Follow these rules:
- Use ONLY metric units (grams, ml, liters, °C). No cups, tablespoons, teaspoons, or ounces.
- calories_per_serving is per ONE serving. Nutrition values are always per single serving.
- Each ingredient must have a "category" field indicating the store section (one of: "Dairy & Eggs", "Meat & Poultry", "Seafood", "Fruits", "Vegetables", "Bakery & Bread", "Pasta & Grains", "Canned & Jarred", "Oils & Condiments", "Spices & Seasonings", "Baking", "Frozen", "Beverages", "Snacks & Nuts", "Other").
- Instructions should reference ingredients by name as they appear in the recipe (e.g. "Add the flour and mix").
- Return ONLY the filled JSON, no extra text.`;

const EMPTY_TEMPLATE = `${AI_INSTRUCTIONS}

${JSON.stringify(
  {
    title: '',
    description: '',
    servings: 4,
    prep_time_minutes: null,
    cook_time_minutes: null,
    category: '',
    tags: [],
    ingredients: [{ name: '', quantity: '', unit: 'g', category: 'Other' }],
    instructions: [''],
    calories_per_serving: null,
    protein_grams: null,
    carbs_grams: null,
    fat_grams: null,
    fiber_grams: null,
    image_url: null,
    source_url: null,
  },
  null,
  2
)}`;

export default function ImportRecipe() {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const [jsonText, setJsonText] = useState('');
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);

  const parseAndSave = async (raw: string) => {
    try {
      // Strip AI instruction comments if present
      const jsonStart = raw.indexOf('{');
      const cleanRaw = jsonStart >= 0 ? raw.substring(jsonStart) : raw;
      const parsed = JSON.parse(cleanRaw);

      const recipe = {
        title: parsed.title || 'Untitled Recipe',
        description: parsed.description || null,
        image_url: parsed.image_url || null,
        servings: parsed.servings || 4,
        prep_time_minutes: parsed.prep_time_minutes || parsed.prepTime || null,
        cook_time_minutes: parsed.cook_time_minutes || parsed.cookTime || null,
        category: parsed.category || null,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        ingredients: Array.isArray(parsed.ingredients)
          ? parsed.ingredients.map((i: any) =>
              typeof i === 'string'
                ? { name: i, quantity: '', unit: '' }
                : { name: i.name || '', quantity: String(i.quantity || ''), unit: i.unit || '', category: i.category || undefined }
            )
          : [],
        instructions: Array.isArray(parsed.instructions)
          ? parsed.instructions.map((s: any) => (typeof s === 'string' ? s : s.text || s.step || ''))
          : [],
        calories_per_serving: parsed.calories_per_serving || parsed.calories || parsed.kcal || null,
        protein_grams: parsed.protein_grams || parsed.protein || null,
        carbs_grams: parsed.carbs_grams || parsed.carbs || parsed.carbohydrates || null,
        fat_grams: parsed.fat_grams || parsed.fat || null,
        fiber_grams: parsed.fiber_grams || parsed.fiber || null,
        source_json: parsed,
        source_url: parsed.source_url || parsed.url || null,
      };

      setSaving(true);
      await createRecipe.mutateAsync(recipe);
      toast.success('Recipe imported!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Invalid JSON');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      parseAndSave(text);
    };
    reader.readAsText(file);
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(EMPTY_TEMPLATE).then(() => {
      toast.success('Template with AI instructions copied! Paste it into ChatGPT or your AI.');
    }).catch(() => toast.error('Could not copy'));
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    setScraping(true);
    try {
      const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('scrape-recipe', {
        body: { url: url.trim() },
      });
      if (scrapeError) throw new Error(scrapeError.message);
      if (!scrapeData?.success) throw new Error(scrapeData?.error || 'Failed to scrape');

      toast.info('Page scraped! Parsing recipe with AI...');

      const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-recipe', {
        body: {
          markdown: scrapeData.markdown,
          title: scrapeData.title,
          source_url: scrapeData.source_url,
        },
      });
      if (parseError) throw new Error(parseError.message);
      if (!parseData?.success) throw new Error(parseData?.error || 'Failed to parse');

      const recipe = parseData.recipe;
      await createRecipe.mutateAsync({
        title: recipe.title || 'Imported Recipe',
        description: recipe.description || null,
        image_url: recipe.image_url || null,
        servings: recipe.servings || 4,
        prep_time_minutes: recipe.prep_time_minutes || null,
        cook_time_minutes: recipe.cook_time_minutes || null,
        category: recipe.category || null,
        tags: recipe.tags || [],
        ingredients: (recipe.ingredients || []).map((i: any) =>
          typeof i === 'string'
            ? { name: i, quantity: '', unit: '' }
            : { name: i.name || '', quantity: String(i.quantity || ''), unit: i.unit || '' }
        ),
        instructions: (recipe.instructions || []).map((s: any) =>
          typeof s === 'string' ? s : s.text || s.step || ''
        ),
        calories_per_serving: recipe.calories_per_serving || null,
        protein_grams: recipe.protein_grams || null,
        carbs_grams: recipe.carbs_grams || null,
        fat_grams: recipe.fat_grams || null,
        fiber_grams: recipe.fiber_grams || null,
        source_json: recipe,
        source_url: recipe.source_url || url.trim(),
      });

      toast.success('Recipe imported from URL!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to import from URL');
    } finally {
      setScraping(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-foreground">Import Recipe</h1>
        <p className="text-muted-foreground font-body">
          Import from a URL, JSON file, or paste JSON directly. All units are metric (g, ml, °C).
        </p>

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url" className="gap-1.5"><Globe className="h-4 w-4" /> From URL</TabsTrigger>
            <TabsTrigger value="json" className="gap-1.5"><FileJson className="h-4 w-4" /> Paste JSON</TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5"><Upload className="h-4 w-4" /> Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Import from URL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground font-body">
                  Paste a recipe URL and we'll scrape and parse it automatically with AI.
                </p>
                <Input
                  placeholder="https://www.example.com/recipe/pasta-carbonara"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button onClick={handleUrlImport} disabled={!url.trim() || scraping} className="w-full gap-2">
                  {scraping ? <><Loader2 className="h-4 w-4 animate-spin" /> Scraping & Parsing...</> : 'Import from URL'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center justify-between">
                  JSON Template for AI
                  <Button variant="outline" size="sm" onClick={handleCopyTemplate} className="gap-1.5">
                    <Copy className="h-4 w-4" /> Copy Template
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-body mb-3">
                  Copy this template (includes AI instructions) and paste it into ChatGPT with your recipe — it will fill it out using metric units only.
                </p>
                <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto max-h-64 text-foreground whitespace-pre-wrap">
                  {EMPTY_TEMPLATE}
                </pre>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Label htmlFor="json">Paste filled JSON</Label>
              <Textarea
                id="json"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={`{\n  "title": "My Recipe",\n  "servings": 4,\n  "ingredients": [...]\n}`}
                rows={12}
                className="font-mono text-sm"
              />
              <Button onClick={() => parseAndSave(jsonText)} disabled={!jsonText.trim() || saving} className="w-full">
                {saving ? 'Importing...' : 'Import Recipe'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Upload JSON File</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-10 cursor-pointer hover:border-primary/50 transition-colors">
                  <FileJson className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-body">Click to select .json file</span>
                  <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
                </label>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

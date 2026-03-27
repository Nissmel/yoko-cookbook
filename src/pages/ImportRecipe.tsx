import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateRecipe } from '@/hooks/useRecipes';
import { toast } from 'sonner';
import { Upload, FileJson } from 'lucide-react';

export default function ImportRecipe() {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const [jsonText, setJsonText] = useState('');
  const [saving, setSaving] = useState(false);

  const parseAndSave = async (raw: string) => {
    try {
      const parsed = JSON.parse(raw);

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
                : { name: i.name || '', quantity: String(i.quantity || ''), unit: i.unit || '' }
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

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-foreground">Import Recipe</h1>
        <p className="text-muted-foreground font-body">
          Import a recipe from a JSON file or paste JSON directly.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Upload className="h-5 w-5" /> Upload JSON File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-10 cursor-pointer hover:border-primary/50 transition-colors">
              <FileJson className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-body">Click to select .json file</span>
              <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground font-body uppercase">or paste JSON</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <Label htmlFor="json">Recipe JSON</Label>
          <Textarea
            id="json"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={`{\n  "title": "My Recipe",\n  "servings": 4,\n  "ingredients": [\n    { "name": "Flour", "quantity": "2", "unit": "cups" }\n  ],\n  "instructions": ["Mix ingredients", "Bake at 350°F"]\n}`}
            rows={12}
            className="font-mono text-sm"
          />
          <Button
            onClick={() => parseAndSave(jsonText)}
            disabled={!jsonText.trim() || saving}
            className="w-full"
          >
            {saving ? 'Importing...' : 'Import Recipe'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

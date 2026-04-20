import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ImagePlus, X } from 'lucide-react';
import { Ingredient, CATEGORIES, COMMON_TAGS } from '@/types/recipe';
import { useCreateRecipe, useUpdateRecipe, uploadRecipeImage, useRecipes } from '@/hooks/useRecipes';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface RecipeFormProps {
  initialData?: {
    id?: string;
    title: string;
    description: string;
    servings: number;
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    category: string;
    tags: string[];
    ingredients: Ingredient[];
    instructions: string[];
    image_url: string | null;
    calories_per_serving: number | null;
    protein_grams: number | null;
    carbs_grams: number | null;
    fat_grams: number | null;
    fiber_grams: number | null;
  };
}

export default function RecipeForm({ initialData }: RecipeFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const { data: allRecipes } = useRecipes();

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [servings, setServings] = useState(initialData?.servings ?? 4);
  const [prepTime, setPrepTime] = useState<number | ''>(initialData?.prep_time_minutes ?? '');
  const [cookTime, setCookTime] = useState<number | ''>(initialData?.cook_time_minutes ?? '');
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialData?.ingredients?.length ? initialData.ingredients : [{ name: '', quantity: '', unit: '' }]
  );
  const [instructions, setInstructions] = useState<string[]>(
    initialData?.instructions?.length ? initialData.instructions : ['']
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [calories, setCalories] = useState<number | ''>(initialData?.calories_per_serving ?? '');
  const [protein, setProtein] = useState<number | ''>(initialData?.protein_grams ?? '');
  const [carbs, setCarbs] = useState<number | ''>(initialData?.carbs_grams ?? '');
  const [fat, setFat] = useState<number | ''>(initialData?.fat_grams ?? '');
  const [fiber, setFiber] = useState<number | ''>(initialData?.fiber_grams ?? '');
  const [newTag, setNewTag] = useState('');

  // Merge default tags with all unique tags ever used by the user
  const userTags = Array.from(
    new Set((allRecipes ?? []).flatMap((r) => r.tags ?? []))
  ).filter((t) => !COMMON_TAGS.includes(t as any));
  const allAvailableTags = [...COMMON_TAGS, ...userTags];

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      toast.error('Tag already added');
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setNewTag('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  };

  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', quantity: '', unit: '' }]);
  const removeIngredient = (index: number) => setIngredients((prev) => prev.filter((_, i) => i !== index));

  const updateInstruction = (index: number, value: string) => {
    setInstructions((prev) => prev.map((inst, i) => (i === index ? value : inst)));
  };

  const addInstruction = () => setInstructions((prev) => [...prev, '']);
  const removeInstruction = (index: number) => setInstructions((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title is required');
    if (!category) return toast.error('Please select a category');
    if (ingredients.filter((i) => i.name.trim()).length === 0) return toast.error('Add at least one ingredient');

    setSaving(true);
    try {
      let image_url = initialData?.image_url ?? null;
      if (imageFile && user) {
        image_url = await uploadRecipeImage(user.id, imageFile);
      }

      const recipeData = {
        title: title.trim(),
        description: description.trim() || null,
        image_url,
        servings,
        prep_time_minutes: prepTime || null,
        cook_time_minutes: cookTime || null,
        category: category || null,
        tags,
        ingredients: ingredients.filter((i) => i.name.trim()),
        instructions: instructions.filter((i) => i.trim()),
        calories_per_serving: calories || null,
        protein_grams: protein || null,
        carbs_grams: carbs || null,
        fat_grams: fat || null,
        fiber_grams: fiber || null,
        source_json: null,
        source_url: null,
      };

      if (initialData?.id) {
        await updateRecipe.mutateAsync({ id: initialData.id, ...recipeData });
        toast.success('Recipe updated!');
      } else {
        await createRecipe.mutateAsync(recipeData);
        toast.success('Recipe created!');
      }
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 px-4 py-6 md:py-10 animate-fade-in">
      <h1 className="font-display text-3xl font-bold text-foreground">
        {initialData?.id ? 'Edit Recipe' : 'Create Recipe'}
      </h1>

      {/* Image upload */}
      <div className="space-y-2">
        <Label>Photo</Label>
        <div className="relative">
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 bg-foreground/70 text-background rounded-full p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border aspect-video cursor-pointer hover:border-primary/50 transition-colors">
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-body">Click to upload photo</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* Basic info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grandma's Pasta" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief description..." rows={2} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Servings</Label>
            <Input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Prep (min)</Label>
            <Input type="number" min={0} value={prepTime} onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : '')} />
          </div>
          <div className="space-y-2">
            <Label>Cook (min)</Label>
            <Input type="number" min={0} value={cookTime} onChange={(e) => setCookTime(e.target.value ? Number(e.target.value) : '')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Category <span className="text-destructive">*</span></Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TAGS.map((tag) => (
              <Badge
                key={tag}
                variant={tags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer font-body transition-colors"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Nutrition */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Nutrition (per serving)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Calories (kcal)</Label>
              <Input type="number" min={0} value={calories} onChange={(e) => setCalories(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Protein (g)</Label>
              <Input type="number" min={0} step={0.1} value={protein} onChange={(e) => setProtein(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Carbs (g)</Label>
              <Input type="number" min={0} step={0.1} value={carbs} onChange={(e) => setCarbs(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fat (g)</Label>
              <Input type="number" min={0} step={0.1} value={fat} onChange={(e) => setFat(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fiber (g)</Label>
              <Input type="number" min={0} step={0.1} value={fiber} onChange={(e) => setFiber(e.target.value ? Number(e.target.value) : '')} />
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Ingredients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input placeholder="Qty" value={ing.quantity} onChange={(e) => updateIngredient(i, 'quantity', e.target.value)} className="w-20" />
              <Input placeholder="Unit" value={ing.unit} onChange={(e) => updateIngredient(i, 'unit', e.target.value)} className="w-20" />
              <Input placeholder="Ingredient name" value={ing.name} onChange={(e) => updateIngredient(i, 'name', e.target.value)} className="flex-1" />
              {ingredients.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(i)} className="text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addIngredient} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Ingredient
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {instructions.map((inst, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="mt-2.5 text-sm font-bold text-primary font-body shrink-0 w-6 text-center">{i + 1}</span>
              <Textarea value={inst} onChange={(e) => updateInstruction(i, e.target.value)} placeholder={`Step ${i + 1}...`} rows={2} className="flex-1" />
              {instructions.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeInstruction(i)} className="text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addInstruction} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Step
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? 'Saving...' : initialData?.id ? 'Update Recipe' : 'Save Recipe'}
      </Button>
    </form>
  );
}

import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useMealPlans, useAddMealPlan, useRemoveMealPlan } from '@/hooks/useMealPlanner';
import { useRecipes } from '@/hooks/useRecipes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, Sparkles, Loader2, Check, BookOpen } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { Link } from 'react-router-dom';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'dessert'];
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  dessert: 'Deser',
};
const PLAN_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'dessert'] as const;

interface MealOption {
  source: 'existing' | 'new';
  recipe_id?: string;
  title: string;
  description?: string;
  category?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
}

interface DayPlan {
  day: number;
  meals: Record<string, { options: MealOption[] }>;
}

export default function MealPlanner() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data: mealPlans, isLoading } = useMealPlans(startDate, endDate);
  const { data: recipes } = useRecipes();
  const addMealPlan = useAddMealPlan();
  const removeMealPlan = useRemoveMealPlan();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('dinner');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  // AI generation state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDays, setAiDays] = useState(7);
  const [aiPreferences, setAiPreferences] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // AI plan selection state
  const [aiPlan, setAiPlan] = useState<DayPlan[] | null>(null);
  const [selections, setSelections] = useState<Record<string, MealOption>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      return { date, dateStr: format(date, 'yyyy-MM-dd'), dayName: format(date, 'EEE'), dayNum: format(date, 'd MMM') };
    }),
    [weekStart]
  );

  const mealsByDay = useMemo(() => {
    const map: Record<string, typeof mealPlans> = {};
    days.forEach((d) => { map[d.dateStr] = []; });
    mealPlans?.forEach((mp) => {
      if (map[mp.plan_date]) map[mp.plan_date]!.push(mp);
    });
    return map;
  }, [mealPlans, days]);

  const openAddDialog = (dateStr: string) => {
    setSelectedDay(dateStr);
    setSelectedRecipeId('');
    setSelectedMealType('dinner');
    setDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!selectedRecipeId || !selectedDay) return;
    try {
      await addMealPlan.mutateAsync({ recipeId: selectedRecipeId, planDate: selectedDay, mealType: selectedMealType });
      toast.success('Added to meal plan!');
      setDialogOpen(false);
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) toast.error('Already planned');
      else toast.error('Failed to add');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeMealPlan.mutateAsync(id);
      toast.success('Removed from plan');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleAIGenerate = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: { recipes: recipes || [], days: aiDays, preferences: aiPreferences || undefined },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const plan = data.plan as DayPlan[];
      if (!plan?.length) throw new Error('Empty plan returned');

      setAiPlan(plan);
      // Start with NO selections — user picks what they want, can skip slots
      setSelections({});
      setAiDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate meal plan');
    } finally {
      setAiLoading(false);
    }
  };

  const selectOption = (dayNum: number, mealType: string, option: MealOption) => {
    const key = `${dayNum}-${mealType}`;
    setSelections((prev) => {
      const current = prev[key];
      // Toggle off if clicking the same option
      if (current && current.title === option.title && current.source === option.source) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: option };
    });
  };

  const handleSavePlan = async () => {
    if (!aiPlan || !user) return;
    setSavingPlan(true);
    let added = 0;
    let newRecipesCreated = 0;

    try {
      for (const dayPlan of aiPlan) {
        const dayIndex = dayPlan.day - 1;
        if (dayIndex >= 7) continue;
        const dateStr = days[dayIndex]?.dateStr;
        if (!dateStr) continue;

        for (const mealType of PLAN_MEAL_TYPES) {
          const key = `${dayPlan.day}-${mealType}`;
          const selected = selections[key];
          if (!selected) continue;

          let recipeId = selected.recipe_id;

          if (selected.source === 'new') {
            // Generate full recipe and save to cookbook
            try {
              const { data: genData, error: genError } = await supabase.functions.invoke('generate-recipe', {
                body: { title: selected.title, description: selected.description, category: selected.category },
              });
              if (genError) throw genError;
              if (genData.error) throw new Error(genData.error);

              const newRecipe = genData.recipe;
              const { data: inserted, error: insertError } = await supabase
                .from('recipes')
                .insert({
                  user_id: user.id,
                  title: newRecipe.title || selected.title,
                  description: newRecipe.description || selected.description || '',
                  category: newRecipe.category || selected.category || 'Dinner',
                  servings: newRecipe.servings || 4,
                  prep_time_minutes: newRecipe.prep_time_minutes,
                  cook_time_minutes: newRecipe.cook_time_minutes,
                  ingredients: newRecipe.ingredients || [],
                  instructions: newRecipe.instructions || [],
                  calories_per_serving: newRecipe.calories_per_serving,
                  protein_grams: newRecipe.protein_grams,
                  carbs_grams: newRecipe.carbs_grams,
                  fat_grams: newRecipe.fat_grams,
                  fiber_grams: newRecipe.fiber_grams,
                  tags: newRecipe.tags || [],
                })
                .select('id')
                .single();

              if (insertError) throw insertError;
              recipeId = inserted.id;
              newRecipesCreated++;
            } catch (e: any) {
              console.error('Failed to create recipe:', selected.title, e);
              toast.error(`Failed to create recipe: ${selected.title}`);
              continue;
            }
          }

          if (recipeId) {
            try {
              await addMealPlan.mutateAsync({ recipeId, planDate: dateStr, mealType });
              added++;
            } catch { /* skip duplicates */ }
          }
        }
      }

      const msg = newRecipesCreated > 0
        ? `Plan saved! ${added} meals added, ${newRecipesCreated} new recipes created in your cookbook.`
        : `Plan saved! ${added} meals added.`;
      toast.success(msg);
      setAiPlan(null);
      setSelections({});
    } catch (e: any) {
      toast.error(e.message || 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  };

  // AI Plan Selection view
  if (aiPlan) {
    const mealTypeLabels: Record<string, string> = { breakfast: '🌅 Śniadanie', lunch: '☀️ Obiad', dinner: '🌙 Kolacja', dessert: '🍰 Deser' };
    const selectedCount = Object.keys(selections).length;
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Choose Your Meals</h1>
              <p className="text-muted-foreground font-body text-sm mt-1">Kliknij propozycję, by ją wybrać. Kliknij ponownie, by odznaczyć. Możesz pominąć dowolny posiłek.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAiPlan(null); setSelections({}); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSavePlan} disabled={savingPlan || selectedCount === 0} className="gap-1.5">
                {savingPlan ? <><Loader2 className="h-4 w-4 animate-spin" /> Zapisywanie...</> : <><Check className="h-4 w-4" /> Zapisz plan ({selectedCount})</>}
              </Button>
            </div>
          </div>

          {aiPlan.map((dayPlan) => (
            <Card key={dayPlan.day}>
              <CardContent className="p-4">
                <h2 className="font-display font-semibold text-lg mb-3">
                  Day {dayPlan.day} — {days[dayPlan.day - 1]?.dayName} {days[dayPlan.day - 1]?.dayNum}
                </h2>
                <div className="space-y-4">
                  {PLAN_MEAL_TYPES.map((mealType) => {
                    const meal = dayPlan.meals[mealType];
                    if (!meal?.options?.length) return null;
                    const key = `${dayPlan.day}-${mealType}`;
                    const selected = selections[key];

                    return (
                      <div key={mealType}>
                        <p className="text-sm font-body font-semibold text-muted-foreground mb-2">{mealTypeLabels[mealType] || mealType}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {meal.options.map((option, i) => {
                            const isSelected = selected?.title === option.title && selected?.source === option.source;
                            return (
                              <button
                                key={i}
                                onClick={() => selectOption(dayPlan.day, mealType, option)}
                                className={`text-left p-3 rounded-xl border-2 transition-all font-body ${
                                  isSelected
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-border hover:border-primary/40 bg-card'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                      {option.title}
                                    </p>
                                    {option.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{option.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {option.source === 'new' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">NEW</span>
                                    )}
                                    {option.source === 'existing' && (
                                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="sticky bottom-20 md:bottom-4 flex justify-center">
            <Button size="lg" onClick={handleSavePlan} disabled={savingPlan || selectedCount === 0} className="gap-2 rounded-xl shadow-lg">
              {savingPlan
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Tworzenie przepisów i zapisywanie...</>
                : selectedCount === 0
                  ? <>Wybierz co najmniej jeden posiłek</>
                  : <><Check className="h-5 w-5" /> Zapisz plan ({selectedCount}) i dodaj nowe przepisy</>}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Meal Planner</h1>
            <p className="text-muted-foreground font-body text-sm mt-1">Plan your meals for the week.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={() => setAiDialogOpen(true)}
          >
            <Sparkles className="h-4 w-4" /> AI Generate
          </Button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-display font-semibold text-sm">
            {format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM yyyy')}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week grid */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(7)].map((_, i) => <div key={i} className="h-20 bg-muted rounded animate-pulse" />)}</div>
        ) : (
          <div className="space-y-2">
            {days.map((day) => {
              const meals = mealsByDay[day.dateStr] || [];
              const isToday = day.dateStr === format(new Date(), 'yyyy-MM-dd');
              return (
                <Card key={day.dateStr} className={isToday ? 'border-primary/50 bg-primary/5' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-display font-semibold text-sm ${isToday ? 'text-primary' : ''}`}>
                          {day.dayName}
                        </span>
                        <span className="text-xs text-muted-foreground">{day.dayNum}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAddDialog(day.dateStr)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {meals.length > 0 ? (
                      <div className="space-y-1.5">
                        {meals.map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 group">
                            <Link to={`/recipe/${meal.recipe_id}`} className="flex items-center gap-2 min-w-0 flex-1">
                              {meal.recipe?.image_url && (
                                <img src={meal.recipe.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-body truncate">{meal.recipe?.title || 'Recipe'}</p>
                                <p className="text-xs text-muted-foreground capitalize">{meal.meal_type}</p>
                              </div>
                            </Link>
                            <button
                              onClick={() => handleRemove(meal.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground font-body">No meals planned</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add meal dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add Meal — {selectedDay && format(new Date(selectedDay + 'T12:00:00'), 'EEE, d MMM')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1.5 block">Meal Type</label>
                <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1.5 block">Recipe</label>
                <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                  <SelectTrigger><SelectValue placeholder="Select a recipe" /></SelectTrigger>
                  <SelectContent>
                    {recipes?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={!selectedRecipeId || addMealPlan.isPending} className="w-full">
                Add to Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Generate dialog */}
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> AI Meal Plan
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground font-body">
                AI will suggest multiple meal options per day — including new recipe ideas. You'll pick your favorites, and new recipes get added to your cookbook!
              </p>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1.5 block">Days to plan</label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={aiDays}
                  onChange={(e) => setAiDays(Math.min(7, Math.max(1, Number(e.target.value))))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1.5 block">Preferences (optional)</label>
                <Input
                  value={aiPreferences}
                  onChange={(e) => setAiPreferences(e.target.value)}
                  placeholder="e.g. low carb, under 500 kcal, vegetarian..."
                  className="rounded-xl"
                />
              </div>
              <Button
                onClick={handleAIGenerate}
                disabled={aiLoading}
                className="w-full gap-2 rounded-xl"
              >
                {aiLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating ideas...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Plan</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

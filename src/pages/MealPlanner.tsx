import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useMealPlans, useAddMealPlan, useRemoveMealPlan, useMoveMealPlan } from '@/hooks/useMealPlanner';
import { useRecipes } from '@/hooks/useRecipes';
import { useAddToShoppingList } from '@/hooks/useShoppingList';
import { useSharedWithMe } from '@/hooks/useRecipeSharing';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, Sparkles, Loader2, Check, BookOpen, RefreshCw, Minus, GripVertical } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

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
  batch_cooking?: boolean;
  leftover_from_day?: number;
}

interface DayPlan {
  day: number;
  meals: Record<string, { options: MealOption[] }>;
}

function Draggable({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${className ?? ''} ${isDragging ? 'opacity-40' : ''} touch-none cursor-grab active:cursor-grabbing`}
    >
      {children}
    </div>
  );
}

function Droppable({ id, children, className, activeClassName }: { id: string; children: React.ReactNode; className?: string; activeClassName?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className ?? ''} ${isOver ? activeClassName ?? '' : ''}`}>
      {children}
    </div>
  );
}

export default function MealPlanner() {
  const { user } = useAuth();
  const { data: sharedOwners } = useSharedWithMe();
  const [viewingOwnerId, setViewingOwnerId] = useState<string>('me');
  const isViewingOwn = viewingOwnerId === 'me';
  const targetOwnerId = isViewingOwn ? undefined : viewingOwnerId;

  // Plan window starts tomorrow — picking meals for past days makes no sense.
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return addDays(d, 1);
  }, []);
  const [weekStart, setWeekStart] = useState<Date>(tomorrow);
  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  

  const { data: mealPlans, isLoading } = useMealPlans(startDate, endDate, targetOwnerId);
  const { data: recipes } = useRecipes();
  const addMealPlan = useAddMealPlan(targetOwnerId);
  const removeMealPlan = useRemoveMealPlan();
  const moveMealPlan = useMoveMealPlan();
  const addToShoppingList = useAddToShoppingList(targetOwnerId);

  // After a meal is planned, push its ingredients into the shopping list.
  // The hook handles merging duplicates AND subtracting pantry stock from
  // the combined demand across recipes.
  const pushRecipeToShoppingList = async (recipeId: string) => {
    const recipe = recipes?.find((r) => r.id === recipeId);
    if (!recipe?.ingredients?.length) return;
    try {
      await addToShoppingList.mutateAsync(
        recipe.ingredients.map((ing: any) => ({
          ingredient_name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          recipe_id: recipeId,
        })),
      );
    } catch (e) {
      // Non-fatal — meal is still planned, we just couldn't update list.
      console.error('Failed to push ingredients to shopping list', e);
    }
  };

  // Drag & drop (planned meals): use @dnd-kit so it works on mobile/touch
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const [activeMealId, setActiveMealId] = useState<string | null>(null);

  const onPlannedDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('planned:')) setActiveMealId(id.slice('planned:'.length));
  };
  const onPlannedDragEnd = async (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    setActiveMealId(null);
    if (!activeId.startsWith('planned:')) return;
    const id = activeId.slice('planned:'.length);
    const overId = e.over?.id ? String(e.over.id) : '';
    if (!overId.startsWith('slot:')) return;
    const [, planDate, mealType] = overId.split(':');
    const meal = mealPlans?.find((m) => m.id === id);
    if (!meal) return;
    if (meal.plan_date === planDate && meal.meal_type === mealType) return;
    try {
      await moveMealPlan.mutateAsync({ id, planDate, mealType });
      toast.success('Posiłek przeniesiony');
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) toast.error('Ten przepis już jest w tym slocie');
      else toast.error('Nie udało się przenieść');
    }
  };

  // Drag & drop (AI selection view): move/swap selected options between slots
  const [activeSelectionKey, setActiveSelectionKey] = useState<string | null>(null);
  const onSelectionDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('sel:')) setActiveSelectionKey(id.slice('sel:'.length));
  };
  const onSelectionDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    setActiveSelectionKey(null);
    if (!activeId.startsWith('sel:')) return;
    const fromKey = activeId.slice('sel:'.length);
    const overId = e.over?.id ? String(e.over.id) : '';
    if (!overId.startsWith('selslot:')) return;
    const toKey = overId.slice('selslot:'.length);
    if (fromKey === toKey) return;
    setSelections((prev) => {
      const moved = prev[fromKey];
      if (!moved) return prev;
      const next = { ...prev };
      const target = next[toKey];
      delete next[fromKey];
      next[toKey] = moved;
      if (target) next[fromKey] = target; // swap
      return next;
    });
  };

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
  const [singleDayDate, setSingleDayDate] = useState<string | null>(null); // when set, aiPlan is for ONE specific date
  const [selections, setSelections] = useState<Record<string, MealOption>>({});
  const [savingPlan, setSavingPlan] = useState(false);
  const [rerollingSlot, setRerollingSlot] = useState<string | null>(null);
  const [rerollingDay, setRerollingDay] = useState<number | null>(null);
  const [generatingDayDate, setGeneratingDayDate] = useState<string | null>(null);

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
      await pushRecipeToShoppingList(selectedRecipeId);
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
      setSingleDayDate(null);
      // Start with NO selections — user picks what they want, can skip slots
      setSelections({});
      setAiDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate meal plan');
    } finally {
      setAiLoading(false);
    }
  };

  const aiGenerateDay = async (dateStr: string) => {
    setGeneratingDayDate(dateStr);
    try {
      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          recipes: recipes || [],
          singleDay: { day: 1 },
          preferences: aiPreferences || undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const meals = data.meals as Record<string, { options: MealOption[] }>;
      if (!meals) throw new Error('Empty plan returned');

      setAiPlan([{ day: 1, meals }]);
      setSingleDayDate(dateStr);
      setSelections({});
      toast.success('Propozycje dnia wygenerowane!');
    } catch (e: any) {
      toast.error(e.message || 'Nie udało się wygenerować dnia');
    } finally {
      setGeneratingDayDate(null);
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

  const rerollSlot = async (dayNum: number, mealType: string) => {
    if (!aiPlan) return;
    const slotKey = `${dayNum}-${mealType}`;
    setRerollingSlot(slotKey);
    try {
      const currentOptions = aiPlan.find((d) => d.day === dayNum)?.meals[mealType]?.options || [];
      const exclude = currentOptions.map((o) => o.title);

      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          recipes: recipes || [],
          singleSlot: { day: dayNum, mealType },
          exclude,
          preferences: aiPreferences || undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const newOptions = data.options as MealOption[];
      if (!newOptions?.length) throw new Error('No options returned');

      setAiPlan((prev) => {
        if (!prev) return prev;
        return prev.map((d) => {
          if (d.day !== dayNum) return d;
          return {
            ...d,
            meals: { ...d.meals, [mealType]: { options: newOptions } },
          };
        });
      });
      // Clear any selection for this slot since options changed
      setSelections((prev) => {
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });
      toast.success('Nowe propozycje wygenerowane!');
    } catch (e: any) {
      toast.error(e.message || 'Nie udało się odświeżyć slotu');
    } finally {
      setRerollingSlot(null);
    }
  };

  const rerollDay = async (dayNum: number) => {
    if (!aiPlan) return;
    setRerollingDay(dayNum);
    try {
      const dayPlan = aiPlan.find((d) => d.day === dayNum);
      const excludeByMeal: Record<string, string[]> = {};
      if (dayPlan) {
        for (const mt of PLAN_MEAL_TYPES) {
          const titles = (dayPlan.meals[mt]?.options || []).map((o) => o.title);
          if (titles.length) excludeByMeal[mt] = titles;
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          recipes: recipes || [],
          singleDay: { day: dayNum },
          excludeByMeal,
          preferences: aiPreferences || undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const newMeals = data.meals as Record<string, { options: MealOption[] }>;
      if (!newMeals) throw new Error('No meals returned');

      setAiPlan((prev) => {
        if (!prev) return prev;
        return prev.map((d) => (d.day === dayNum ? { ...d, meals: newMeals } : d));
      });
      // Clear all selections for this day
      setSelections((prev) => {
        const next = { ...prev };
        for (const mt of PLAN_MEAL_TYPES) delete next[`${dayNum}-${mt}`];
        return next;
      });
      toast.success(`Dzień ${dayNum} — nowe propozycje wygenerowane!`);
    } catch (e: any) {
      toast.error(e.message || 'Nie udało się odświeżyć dnia');
    } finally {
      setRerollingDay(null);
    }
  };

  const handleSavePlan = async () => {
    if (!aiPlan || !user) return;
    setSavingPlan(true);
    let added = 0;
    let newRecipesCreated = 0;
    // Cache: title -> recipe_id, so leftovers reuse the same recipe as the original day
    const titleToRecipeId: Record<string, string> = {};
    // Cache: recipe_id -> ingredients (works for both pre-existing and freshly-created recipes)
    const recipeIngredients: Record<string, any[]> = {};
    // Track which recipes were newly added to the plan, to avoid pushing
    // ingredients twice when the same recipe (e.g. leftover) appears on two days.
    const plannedRecipeIds = new Set<string>();

    try {
      for (const dayPlan of aiPlan) {
        // Single-day mode: use the explicitly chosen date; otherwise map by index in current week
        const dateStr = singleDayDate ?? days[dayPlan.day - 1]?.dateStr;
        if (!dateStr) continue;

        for (const mealType of PLAN_MEAL_TYPES) {
          const key = `${dayPlan.day}-${mealType}`;
          const selected = selections[key];
          if (!selected) continue;

          let recipeId = selected.recipe_id;
          // Normalize title (strip ♻️ prefix from leftovers) for cache lookup
          const normalizedTitle = selected.title.replace(/^♻️\s*/, '').trim();

          // If this is a leftover and we already created/linked the original — reuse it
          if (!recipeId && titleToRecipeId[normalizedTitle]) {
            recipeId = titleToRecipeId[normalizedTitle];
          }

          if (!recipeId && selected.source === 'new') {
            // Generate full recipe and save to cookbook
            try {
              const { data: genData, error: genError } = await supabase.functions.invoke('generate-recipe', {
                body: { title: normalizedTitle, description: selected.description, category: selected.category },
              });
              if (genError) throw genError;
              if (genData.error) throw new Error(genData.error);

              const newRecipe = genData.recipe;
              const { data: inserted, error: insertError } = await supabase
                .from('recipes')
                .insert({
                  user_id: user.id,
                  title: newRecipe.title || normalizedTitle,
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
              titleToRecipeId[normalizedTitle] = recipeId;
              recipeIngredients[recipeId] = newRecipe.ingredients || [];
              newRecipesCreated++;
            } catch (e: any) {
              console.error('Failed to create recipe:', selected.title, e);
              toast.error(`Failed to create recipe: ${selected.title}`);
              continue;
            }
          } else if (recipeId) {
            // Cache existing recipe id by title too, so leftovers can find it
            titleToRecipeId[normalizedTitle] = recipeId;
            if (!recipeIngredients[recipeId]) {
              const existing = recipes?.find((r) => r.id === recipeId);
              if (existing?.ingredients) recipeIngredients[recipeId] = existing.ingredients;
            }
          }

          if (recipeId) {
            try {
              await addMealPlan.mutateAsync({ recipeId, planDate: dateStr, mealType });
              added++;
              plannedRecipeIds.add(recipeId);
            } catch { /* skip duplicates */ }
          }
        }
      }

      // Push all planned recipes' ingredients to the shopping list in ONE call,
      // so duplicates merge AND pantry is subtracted from total demand.
      const allIngredients: { ingredient_name: string; quantity?: string; unit?: string; recipe_id?: string }[] = [];
      for (const rid of plannedRecipeIds) {
        const ings = recipeIngredients[rid];
        if (!ings) continue;
        for (const ing of ings) {
          if (!ing?.name) continue;
          allIngredients.push({
            ingredient_name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            recipe_id: rid,
          });
        }
      }
      if (allIngredients.length > 0) {
        try {
          await addToShoppingList.mutateAsync(allIngredients);
        } catch (e) {
          console.error('Failed to update shopping list', e);
        }
      }

      const msg = newRecipesCreated > 0
        ? `Plan saved! ${added} meals added, ${newRecipesCreated} new recipes created.`
        : `Plan saved! ${added} meals added.`;
      toast.success(msg);
      setAiPlan(null);
      setSingleDayDate(null);
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
    const activeSelected = activeSelectionKey ? selections[activeSelectionKey] : null;
    return (
      <AppLayout>
        <DndContext sensors={sensors} onDragStart={onSelectionDragStart} onDragEnd={onSelectionDragEnd} onDragCancel={() => setActiveSelectionKey(null)}>
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Choose Your Meals</h1>
              <p className="text-muted-foreground font-body text-sm mt-1">Kliknij propozycję, by ją wybrać. Przeciągnij wybrany posiłek na inny slot, by go przenieść.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAiPlan(null); setSingleDayDate(null); setSelections({}); }}>
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
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-lg">
                    {singleDayDate
                      ? format(new Date(singleDayDate + 'T12:00:00'), 'EEE, d MMM')
                      : `Day ${dayPlan.day} — ${days[dayPlan.day - 1]?.dayName} ${days[dayPlan.day - 1]?.dayNum}`}
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => rerollDay(dayPlan.day)}
                    disabled={rerollingDay === dayPlan.day}
                  >
                    {rerollingDay === dayPlan.day ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generowanie dnia...</>
                    ) : (
                      <><RefreshCw className="h-3.5 w-3.5" /> Reroll dnia</>
                    )}
                  </Button>
                </div>
                <div className="space-y-4">
                  {PLAN_MEAL_TYPES.map((mealType) => {
                    const meal = dayPlan.meals[mealType];
                    if (!meal?.options?.length) return null;
                    const key = `${dayPlan.day}-${mealType}`;
                    const selected = selections[key];

                    return (
                      <Droppable
                        key={mealType}
                        id={`selslot:${key}`}
                        className="rounded-lg border-2 border-transparent transition-colors p-1 -m-1"
                        activeClassName="!border-primary !bg-primary/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <p className="text-sm font-body font-semibold text-muted-foreground">{mealTypeLabels[mealType] || mealType}</p>
                            {selected && (
                              <Draggable
                                id={`sel:${key}`}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/30 max-w-[180px]"
                              >
                                <GripVertical className="h-3 w-3 shrink-0" />
                                <span className="truncate">{selected.title}</span>
                              </Draggable>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
                            onClick={() => rerollSlot(dayPlan.day, mealType)}
                            disabled={rerollingSlot === key}
                          >
                            {rerollingSlot === key ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Generowanie...</>
                            ) : (
                              <><RefreshCw className="h-3 w-3" /> Nowe propozycje</>
                            )}
                          </Button>
                        </div>
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
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold break-words ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                      {option.title}
                                    </p>
                                    {option.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{option.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end max-w-[40%]">
                                    {option.leftover_from_day && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium" title={`Z dnia ${option.leftover_from_day}`}>
                                        ♻️ Wczorajsze
                                      </span>
                                    )}
                                    {option.batch_cooking && !option.leftover_from_day && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium" title="Większa porcja — starczy na 2 dni">
                                        2x porcja
                                      </span>
                                    )}
                                    {option.source === 'new' && !option.leftover_from_day && (
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
                      </Droppable>
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
        <DragOverlay>
          {activeSelected ? (
            <div className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium shadow-lg">
              <GripVertical className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{activeSelected.title}</span>
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      </AppLayout>
    );
  }

  const ownerLabel = (() => {
    if (isViewingOwn) return null;
    const owner = sharedOwners?.find((o) => o.recipe_owner_id === viewingOwnerId);
    return owner?.owner_display_name || owner?.owner_email || 'Wspólny planer';
  })();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold text-foreground">Meal Planner</h1>
            <p className="text-muted-foreground font-body text-sm mt-1 truncate">
              {ownerLabel ? `Planer: ${ownerLabel}` : 'Plan your meals for the week.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {sharedOwners && sharedOwners.length > 0 && (
              <Select value={viewingOwnerId} onValueChange={setViewingOwnerId}>
                <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Mój planer</SelectItem>
                  {sharedOwners.map((o) => (
                    <SelectItem key={o.recipe_owner_id} value={o.recipe_owner_id}>
                      {o.owner_display_name || o.owner_email || 'Shared'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isViewingOwn && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => setAiDialogOpen(true)}
              >
                <Sparkles className="h-4 w-4" /> AI Generate
              </Button>
            )}
          </div>
        </div>

        {/* Window navigation (7-day rolling). Default starts tomorrow, but
            user can browse freely backward to view/edit historical plans. */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display font-semibold text-sm truncate">
              {format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM yyyy')}
            </span>
            {weekStart.getTime() !== tomorrow.getTime() && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWeekStart(tomorrow)}>
                Dziś
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week grid */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(7)].map((_, i) => <div key={i} className="h-20 bg-muted rounded animate-pulse" />)}</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={onPlannedDragStart} onDragEnd={onPlannedDragEnd} onDragCancel={() => setActiveMealId(null)}>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-body -mb-1">
                💡 Wskazówka: przeciągnij posiłek na inny slot lub dzień, by go przenieść.
              </p>
              {days.map((day) => {
                const meals = mealsByDay[day.dateStr] || [];
                const isToday = day.dateStr === format(new Date(), 'yyyy-MM-dd');
                const mealsBySlot: Record<string, typeof meals> = {
                  breakfast: [], lunch: [], dinner: [], dessert: [],
                };
                meals.forEach((m) => {
                  if (mealsBySlot[m.meal_type]) mealsBySlot[m.meal_type].push(m);
                  else mealsBySlot.dinner.push(m);
                });
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
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => aiGenerateDay(day.dateStr)}
                            disabled={generatingDayDate === day.dateStr}
                            title="Wygeneruj propozycje AI dla tego dnia"
                          >
                            {generatingDayDate === day.dateStr
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Sparkles className="h-3.5 w-3.5" />}
                            <span className="hidden xs:inline">AI</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAddDialog(day.dateStr)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {meals.length === 0 ? (
                        <Droppable
                          id={`slot:${day.dateStr}:dinner`}
                          className="text-xs text-muted-foreground font-body py-2 px-2 rounded-md border-2 border-dashed transition-colors border-transparent"
                          activeClassName="!border-primary !bg-primary/5 !text-primary"
                        >
                          {activeMealId ? 'Upuść tutaj' : 'No meals planned'}
                        </Droppable>
                      ) : (
                        <div className="space-y-2">
                          {MEAL_TYPES.map((slot) => {
                            const slotMeals = mealsBySlot[slot];
                            const showSlot = slotMeals.length > 0 || !!activeMealId;
                            if (!showSlot) return null;
                            return (
                              <Droppable
                                key={slot}
                                id={`slot:${day.dateStr}:${slot}`}
                                className={`rounded-md border-2 transition-colors border-transparent ${
                                  slotMeals.length === 0 && activeMealId ? 'border-dashed border-border p-1.5' : ''
                                }`}
                                activeClassName="!border-primary !bg-primary/5"
                              >
                                {slotMeals.length === 0 && activeMealId ? (
                                  <p className="text-[11px] text-muted-foreground font-body text-center">{MEAL_TYPE_LABELS[slot]}</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {slotMeals.map((meal) => (
                                      <Draggable
                                        key={meal.id}
                                        id={`planned:${meal.id}`}
                                        className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 group transition-opacity"
                                      >
                                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mr-1" />
                                        <Link to={`/recipe/${meal.recipe_id}`} className="flex items-center gap-2 min-w-0 flex-1" onPointerDown={(e) => e.stopPropagation()}>
                                          {meal.recipe?.image_url && (
                                            <img src={meal.recipe.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                          )}
                                          <div className="min-w-0">
                                            <p className="text-sm font-body break-words">{meal.recipe?.title || 'Recipe'}</p>
                                            <p className="text-xs text-muted-foreground">{MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}</p>
                                          </div>
                                        </Link>
                                        <button
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={() => handleRemove(meal.id)}
                                          className="opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1 p-1"
                                          aria-label="Remove"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </Draggable>
                                    ))}
                                  </div>
                                )}
                              </Droppable>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <DragOverlay>
              {activeMealId ? (
                <div className="rounded-md bg-card border border-primary shadow-lg px-2 py-1.5 text-sm font-body">
                  {mealPlans?.find((m) => m.id === activeMealId)?.recipe?.title || 'Posiłek'}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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
                      <SelectItem key={t} value={t}>{MEAL_TYPE_LABELS[t] || t}</SelectItem>
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
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl shrink-0"
                    onClick={() => setAiDays((d) => Math.max(1, d - 1))}
                    disabled={aiDays <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <span className="font-display text-2xl font-bold">{aiDays}</span>
                    <span className="text-sm text-muted-foreground font-body ml-1">{aiDays === 1 ? 'dzień' : aiDays < 5 ? 'dni' : 'dni'}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl shrink-0"
                    onClick={() => setAiDays((d) => Math.min(7, d + 1))}
                    disabled={aiDays >= 7}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
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

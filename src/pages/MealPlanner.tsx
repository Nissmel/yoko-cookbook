import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useMealPlans, useAddMealPlan, useRemoveMealPlan } from '@/hooks/useMealPlanner';
import { useRecipes } from '@/hooks/useRecipes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { Link } from 'react-router-dom';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealPlanner() {
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Meal Planner</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">Plan your meals for the week.</p>
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
      </div>
    </AppLayout>
  );
}

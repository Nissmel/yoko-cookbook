import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MealPlan {
  id: string;
  recipe_id: string;
  plan_date: string;
  meal_type: string;
  created_at: string;
  recipe?: {
    id: string;
    title: string;
    image_url: string | null;
    category: string | null;
  };
}

export function useMealPlans(startDate: string, endDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['meal-plans', user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .gte('plan_date', startDate)
        .lte('plan_date', endDate)
        .order('plan_date');
      if (error) throw error;

      // Fetch recipe details
      const recipeIds = [...new Set((data as any[]).map((d) => d.recipe_id))];
      if (!recipeIds.length) return [];

      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, title, image_url, category')
        .in('id', recipeIds);

      const recipeMap: Record<string, any> = {};
      recipes?.forEach((r: any) => { recipeMap[r.id] = r; });

      return (data as any[]).map((mp) => ({
        ...mp,
        recipe: recipeMap[mp.recipe_id] || null,
      })) as MealPlan[];
    },
    enabled: !!user,
  });
}

export function useAddMealPlan() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ recipeId, planDate, mealType }: { recipeId: string; planDate: string; mealType: string }) => {
      const { error } = await supabase
        .from('meal_plans')
        .insert({ user_id: user!.id, recipe_id: recipeId, plan_date: planDate, meal_type: mealType });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }),
  });
}

export function useRemoveMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }),
  });
}

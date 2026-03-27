import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, Ingredient } from '@/types/recipe';
import { useAuth } from './useAuth';

export function useRecipes(search?: string, category?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recipes', user?.id, search, category],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        ingredients: (r.ingredients as unknown as Ingredient[]) ?? [],
        instructions: (r.instructions as unknown as string[]) ?? [],
        tags: r.tags ?? [],
      })) as Recipe[];
    },
    enabled: !!user,
  });
}

export function useRecipe(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return {
        ...data,
        ingredients: (data.ingredients as unknown as Ingredient[]) ?? [],
        instructions: (data.instructions as unknown as string[]) ?? [],
        tags: data.tags ?? [],
      } as Recipe;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          ...recipe,
          user_id: user!.id,
          ingredients: recipe.ingredients as unknown as any,
          instructions: recipe.instructions as unknown as any,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...recipe }: Partial<Recipe> & { id: string }) => {
      const updateData: any = { ...recipe };
      if (recipe.ingredients) updateData.ingredients = recipe.ingredients as unknown as any;
      if (recipe.instructions) updateData.instructions = recipe.instructions as unknown as any;

      const { data, error } = await supabase
        .from('recipes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export async function uploadRecipeImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from('recipe-images').upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from('recipe-images').getPublicUrl(path);
  return data.publicUrl;
}

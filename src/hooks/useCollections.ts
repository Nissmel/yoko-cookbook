import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  recipe_count?: number;
}

export function useCollections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['collections', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_collections')
        .select('*')
        .order('name');
      if (error) throw error;

      // Get counts
      const { data: items } = await supabase
        .from('recipe_collection_items')
        .select('collection_id');

      const counts: Record<string, number> = {};
      items?.forEach((i: any) => {
        counts[i.collection_id] = (counts[i.collection_id] || 0) + 1;
      });

      return (data as Collection[]).map((c) => ({
        ...c,
        recipe_count: counts[c.id] || 0,
      }));
    },
    enabled: !!user,
  });
}

export function useCollectionRecipes(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collection-recipes', collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_collection_items')
        .select('recipe_id')
        .eq('collection_id', collectionId!);
      if (error) throw error;

      if (!data.length) return [];

      const { data: recipes, error: rErr } = await supabase
        .from('recipes')
        .select('*')
        .in('id', data.map((d: any) => d.recipe_id));
      if (rErr) throw rErr;
      return recipes;
    },
    enabled: !!collectionId,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { error } = await supabase
        .from('recipe_collections')
        .insert({ name, description: description || null, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipe_collections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function useAddToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) => {
      const { error } = await supabase
        .from('recipe_collection_items')
        .insert({ collection_id: collectionId, recipe_id: recipeId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['collection-recipes'] });
    },
  });
}

export function useRemoveFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) => {
      const { error } = await supabase
        .from('recipe_collection_items')
        .delete()
        .eq('collection_id', collectionId)
        .eq('recipe_id', recipeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['collection-recipes'] });
    },
  });
}

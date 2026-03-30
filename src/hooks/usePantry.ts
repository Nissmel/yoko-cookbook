import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  created_at: string;
}

export function usePantryItems() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pantry', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as PantryItem[];
    },
    enabled: !!user,
  });
}

export function useAddPantryItems() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (items: { name: string; quantity?: string; unit?: string }[]) => {
      const { error } = await supabase
        .from('pantry_items')
        .insert(items.map((i) => ({ ...i, user_id: user!.id })));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
    },
  });
}

export function useDeletePantryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pantry_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
    },
  });
}

export function useClearPantry() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
    },
  });
}

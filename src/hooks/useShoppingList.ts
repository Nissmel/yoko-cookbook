import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingListItem } from '@/types/recipe';
import { useAuth } from './useAuth';

export function useShoppingList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shopping-list', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ShoppingListItem[];
    },
    enabled: !!user,
  });
}

export function useAddToShoppingList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (items: { ingredient_name: string; quantity?: string; unit?: string; recipe_id?: string }[]) => {
      const { error } = await supabase
        .from('shopping_list_items')
        .insert(items.map((i) => ({ ...i, user_id: user!.id })));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

export function useToggleShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ checked })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

export function useClearCheckedItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('checked', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingListItem } from '@/types/recipe';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Normalize PL diacritics + lowercase for fuzzy comparison
function normalize(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[ąà]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęè]/g, 'e')
    .replace(/[łl]/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óò]/g, 'o')
    .replace(/[śš]/g, 's').replace(/[źżž]/g, 'z');
}

function pantryHasIngredient(pantryNames: string[], ingredientName: string): boolean {
  const ing = normalize(ingredientName);
  return pantryNames.some((p) => {
    const pn = normalize(p);
    return ing.includes(pn) || pn.includes(ing);
  });
}

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
    mutationFn: async (
      items: { ingredient_name: string; quantity?: string; unit?: string; recipe_id?: string }[],
    ) => {
      // Smart shopping: filter out anything already in the pantry
      const { data: pantry } = await supabase
        .from('pantry_items')
        .select('name');
      const pantryNames = (pantry ?? []).map((p) => p.name);

      const filtered = items.filter((i) => !pantryHasIngredient(pantryNames, i.ingredient_name));
      const skipped = items.length - filtered.length;

      if (filtered.length === 0) {
        return { inserted: 0, skipped };
      }

      const { error } = await supabase
        .from('shopping_list_items')
        .insert(filtered.map((i) => ({ ...i, user_id: user!.id })));
      if (error) throw error;

      return { inserted: filtered.length, skipped };
    },
    onSuccess: ({ inserted, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      if (skipped > 0 && inserted > 0) {
        toast.success(`Added ${inserted} items`, {
          description: `Skipped ${skipped} you already have in pantry`,
        });
      } else if (skipped > 0 && inserted === 0) {
        toast.info('You already have everything in your pantry!');
      } else if (inserted > 0) {
        toast.success(`Added ${inserted} items to shopping list`);
      }
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

export function useClearAllItems() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

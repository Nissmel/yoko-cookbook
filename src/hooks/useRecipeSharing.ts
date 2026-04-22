import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface RecipeShare {
  id: string;
  recipe_owner_id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  created_at: string;
}

export function useMyShares() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recipe-shares', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_shares')
        .select('*')
        .eq('recipe_owner_id', user!.id);
      if (error) throw error;
      return data as RecipeShare[];
    },
    enabled: !!user,
  });
}

// Shares where the CURRENT user is the recipient (i.e. people who shared with me).
// Joins to profiles to surface the owner's display_name + email for the UI.
export interface ReceivedShare {
  id: string;
  recipe_owner_id: string;
  owner_email: string | null;
  owner_display_name: string | null;
}

export function useSharedWithMe() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recipe-shares-received', user?.id],
    queryFn: async () => {
      const { data: sharesData, error } = await supabase
        .from('recipe_shares')
        .select('id, recipe_owner_id')
        .eq('shared_with_user_id', user!.id);
      if (error) throw error;

      const shares = sharesData ?? [];
      if (shares.length === 0) return [] as ReceivedShare[];

      const ownerIds = Array.from(new Set(shares.map((s) => s.recipe_owner_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, display_name')
        .in('user_id', ownerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p]),
      );

      return shares.map((s) => {
        const p = profileMap.get(s.recipe_owner_id);
        return {
          id: s.id,
          recipe_owner_id: s.recipe_owner_id,
          owner_email: p?.email ?? null,
          owner_display_name: p?.display_name ?? null,
        } as ReceivedShare;
      });
    },
    enabled: !!user,
  });
}

export function useShareRecipes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (email: string) => {
      // Try to find the user by email to pre-fill shared_with_user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();

      const { error } = await supabase
        .from('recipe_shares')
        .insert({
          recipe_owner_id: user!.id,
          shared_with_email: email,
          shared_with_user_id: profile?.user_id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-shares'] });
    },
  });
}

export function useRemoveShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recipe_shares')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-shares'] });
    },
  });
}

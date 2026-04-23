import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type RecipeSource = {
  id: string;
  name: string;
  base_url: string;
  description: string | null;
  is_active: boolean;
  last_crawled_at: string | null;
  recipe_count: number;
};

export type ScrapedRecipe = {
  id: string;
  source_id: string;
  title: string;
  source_url: string;
  image_url: string | null;
  scraped_at: string;
  import_count: number;
};

export function useRecipeSources() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recipe-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_sources')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as RecipeSource[];
    },
    enabled: !!user,
  });
}

export function useScrapedRecipes(sourceId?: string, search?: string, limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['scraped-recipes', sourceId, search, limit],
    queryFn: async () => {
      let q = supabase
        .from('scraped_recipes')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(limit);
      if (sourceId) q = q.eq('source_id', sourceId);
      if (search) q = q.ilike('title', `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as ScrapedRecipe[];
    },
    enabled: !!user,
  });
}

export function useCrawlSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.functions.invoke('crawl-recipe-source', {
        body: { source_id: sourceId },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Crawl failed');
      return data as {
        success: true;
        started?: boolean;
        source: string;
        strategy?: string;
        message?: string;
        candidates_found?: number;
        new_indexed?: number;
        total_in_source?: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-sources'] });
      queryClient.invalidateQueries({ queryKey: ['scraped-recipes'] });
      // Re-check after a delay so the UI picks up background-crawl progress.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['recipe-sources'] });
        queryClient.invalidateQueries({ queryKey: ['scraped-recipes'] });
      }, 60_000);
    },
  });
}

export async function incrementScrapedImportCount(scrapedId: string) {
  // Best-effort — failure is non-fatal for the import flow.
  try {
    await supabase.rpc('increment_scraped_import_count' as never, { _scraped_id: scrapedId } as never);
  } catch (err) {
    console.warn('Could not increment scraped import count', err);
  }
}

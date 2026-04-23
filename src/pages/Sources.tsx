import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useRecipeSources,
  useScrapedRecipes,
  useCrawlSource,
  incrementScrapedImportCount,
  type ScrapedRecipe,
} from '@/hooks/useRecipeSources';
import { useCreateRecipe } from '@/hooks/useRecipes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  RefreshCw,
  Globe,
  Search,
  Download,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function Sources() {
  const navigate = useNavigate();
  const { data: sources, isLoading: sourcesLoading } = useRecipeSources();
  const [selectedSource, setSelectedSource] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const { data: scraped, isLoading: scrapedLoading } = useScrapedRecipes(
    selectedSource,
    search.trim() || undefined,
    100,
  );
  const crawl = useCrawlSource();
  const createRecipe = useCreateRecipe();
  const [importingId, setImportingId] = useState<string | null>(null);
  const [crawlingId, setCrawlingId] = useState<string | null>(null);

  const handleCrawl = async (sourceId: string, sourceName: string) => {
    setCrawlingId(sourceId);
    try {
      const result = await crawl.mutateAsync(sourceId);
      if (result.started) {
        toast.success(
          `${sourceName}: crawl uruchomiony w tle. Odśwież listę za 1–2 minuty, by zobaczyć nowe przepisy.`,
        );
      } else {
        toast.success(
          `${sourceName}: znaleziono ${result.candidates_found ?? 0} kandydatów, ${result.new_indexed ?? 0} nowych (łącznie ${result.total_in_source ?? 0})`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Błąd crawla';
      toast.error(msg);
    } finally {
      setCrawlingId(null);
    }
  };

  const handleImport = async (item: ScrapedRecipe) => {
    setImportingId(item.id);
    try {
      // 1. Scrape full page
      const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke(
        'scrape-recipe',
        { body: { url: item.source_url } },
      );
      if (scrapeError) throw new Error(scrapeError.message);
      if (!scrapeData?.success) throw new Error(scrapeData?.error || 'Scrape nieudany');

      // 2. AI parse to our JSON format
      const { data: parseData, error: parseError } = await supabase.functions.invoke(
        'parse-recipe',
        {
          body: {
            markdown: scrapeData.markdown,
            title: scrapeData.title || item.title,
            source_url: item.source_url,
          },
        },
      );
      if (parseError) throw new Error(parseError.message);
      if (!parseData?.success) throw new Error(parseData?.error || 'Parse nieudany');

      const recipe = parseData.recipe;
      await createRecipe.mutateAsync({
        title: recipe.title || item.title,
        description: recipe.description || null,
        image_url: recipe.image_url || item.image_url || null,
        servings: recipe.servings || 4,
        prep_time_minutes: recipe.prep_time_minutes || null,
        cook_time_minutes: recipe.cook_time_minutes || null,
        category: recipe.category || null,
        tags: recipe.tags || [],
        ingredients: (recipe.ingredients || []).map((i: { name?: string; quantity?: unknown; unit?: string; category?: string }) =>
          typeof i === 'string'
            ? { name: i, quantity: '', unit: '' }
            : { name: i.name || '', quantity: String(i.quantity || ''), unit: i.unit || '', category: i.category },
        ),
        instructions: (recipe.instructions || []).map((s: unknown) =>
          typeof s === 'string' ? s : (s as { text?: string; step?: string }).text || (s as { step?: string }).step || '',
        ),
        calories_per_serving: recipe.calories_per_serving || null,
        protein_grams: recipe.protein_grams || null,
        carbs_grams: recipe.carbs_grams || null,
        fat_grams: recipe.fat_grams || null,
        fiber_grams: recipe.fiber_grams || null,
        source_json: recipe,
        source_url: item.source_url,
      });

      await incrementScrapedImportCount(item.id);
      toast.success('Przepis zaimportowany!');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import nieudany';
      toast.error(msg);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in overflow-x-hidden">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" /> Recipe Sources
          </h1>
          <p className="text-muted-foreground font-body mt-1">
            Biblioteka inspiracji z polskich blogów kulinarnych. Crawluj, przeglądaj, importuj.
          </p>
        </div>

        {/* Sources list */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Źródła</h2>
          {sourcesLoading && <p className="text-sm text-muted-foreground">Wczytywanie…</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {sources?.map((s) => (
              <Card key={s.id} className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base flex items-center justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    <Badge variant="secondary" className="font-body shrink-0">
                      {s.recipe_count} przepisów
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <a
                    href={s.base_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground font-body hover:text-primary inline-flex items-center gap-1 truncate"
                  >
                    {s.base_url} <ExternalLink className="h-3 w-3" />
                  </a>
                  {s.description && (
                    <p className="text-sm text-muted-foreground font-body">{s.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground font-body">
                      {s.last_crawled_at
                        ? `Ostatnio: ${formatDistanceToNow(new Date(s.last_crawled_at), { addSuffix: true, locale: pl })}`
                        : 'Nigdy nie crawlowane'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCrawl(s.id, s.name)}
                      disabled={crawlingId === s.id}
                      className="gap-1.5"
                    >
                      {crawlingId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Crawluj
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Browse / search scraped */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Biblioteka inspiracji
          </h2>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po tytule…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedSource ?? 'all'}
              onValueChange={(v) => setSelectedSource(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Wszystkie źródła" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie źródła</SelectItem>
                {sources?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scrapedLoading && <p className="text-sm text-muted-foreground">Wczytywanie…</p>}

          {!scrapedLoading && scraped && scraped.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground font-body">
                Brak zaindeksowanych przepisów. Kliknij "Crawluj" przy źródle, aby je pobrać.
              </CardContent>
            </Card>
          )}

          <ul className="grid gap-2">
            {scraped?.map((item) => {
              const sourceName = sources?.find((s) => s.id === item.source_id)?.name || '';
              const isImporting = importingId === item.id;
              const wasImported = item.import_count > 0;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-body font-medium text-foreground truncate flex items-center gap-2">
                      {item.title}
                      {wasImported && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Badge variant="outline" className="font-body text-[10px] py-0 h-4">
                        {sourceName}
                      </Badge>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary truncate inline-flex items-center gap-1"
                      >
                        Zobacz <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleImport(item)}
                    disabled={isImporting}
                    className="gap-1.5 shrink-0"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importowanie…
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" /> Importuj
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppLayout>
  );
}

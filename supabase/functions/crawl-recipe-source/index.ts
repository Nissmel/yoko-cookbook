// Crawl a recipe blog and index recipe titles + URLs into public.scraped_recipes.
//
// Strategy:
//   1. Try Firecrawl /v2/map (sitemap-based) — works great for sites with sitemaps
//      (aniagotuje.pl, mojewypieki.com).
//   2. For sites with weak/no sitemap (kwestiasmaku.com), fall back to a deep
//      navigation crawl: scrape the homepage to discover category/tag index
//      pages, then scrape each one to collect recipe URLs from their listings.
//
// Auth: requires logged-in user. Idempotent via unique source_url.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Per-domain heuristics: which URL paths look like an individual recipe page.
function isRecipeUrl(url: string, baseUrl: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) return false;

    const path = u.pathname.toLowerCase();

    const rejectPatterns = [
      /^\/?$/,
      /^\/(tag|tagi|kategoria|kategorie|category|categories|autor|author|kontakt|contact|o-(mnie|nas)|polityka|regulamin|sklep|shop|cart|koszyk|search|szukaj|page|strona|konto|account|login|logowanie|rejestracja|newsletter|drukuj|info|ranking|ksiega|zdjecia|listy-przepisow|user-pics|user|users|forum|cookies)\b/,
      /\.(jpg|jpeg|png|gif|webp|svg|pdf|xml|json|css|js|ico)$/,
      /^\/feed\b/,
      /^\/wp-/,
      /\/fav_category\b/,
      /\/przepisy-uzytkownikow\b/,
      /-sitemap/,
    ];
    if (rejectPatterns.some((re) => re.test(path))) return false;

    const SLUG = '[a-z0-9\\-_%]+';
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'kwestiasmaku.com') {
      // ONLY /przepis/<slug> (singular) and /blog-kulinarny/<slug> are real
      // recipe pages. /przepisy/<slug> (plural) are tag/category pages.
      const re = new RegExp(
        `^\\/przepis\\/${SLUG}\\/?$|^\\/blog-kulinarny\\/${SLUG}\\/?$`,
      );
      if (!re.test(path)) return false;
      // Reject blog-kulinarny utility paths
      if (/^\/blog-kulinarny\/(category|tag|page|archive)\b/.test(path)) return false;
      return true;
    }

    if (host === 'aniagotuje.pl') {
      return new RegExp(`^\\/przepis\\/${SLUG}\\/?$`).test(path);
    }

    if (host === 'mojewypieki.com') {
      return new RegExp(`^\\/przepis\\/${SLUG}\\/?$`).test(path);
    }

    return new RegExp(`\\/(przepis|przepisy|recipe|recipes)\\/${SLUG}`, 'i').test(path);
  } catch {
    return false;
  }
}

function deriveTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(slug)
      .replace(/[-_]+/g, ' ')
      .replace(/\.html?$/i, '')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

// ---------- Firecrawl helpers ----------

async function firecrawlMap(
  apiKey: string,
  url: string,
  limit: number,
): Promise<string[]> {
  const res = await fetch('https://api.firecrawl.dev/v2/map', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit, includeSubdomains: false, sitemap: 'include' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`map failed [${res.status}]: ${JSON.stringify(data)}`);
  const raw: Array<string | { url: string }> = data.links || data.data?.links || [];
  return raw.map((l) => (typeof l === 'string' ? l : l.url)).filter(Boolean);
}

async function firecrawlScrapeLinks(apiKey: string, url: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formats: ['links'],
        onlyMainContent: false,
        waitFor: 3000,
        timeout: 30000,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.links || data.links || []).filter((l: unknown) => typeof l === 'string');
  } catch {
    return [];
  }
}

async function firecrawlScrapeMarkdown(apiKey: string, url: string): Promise<{ markdown: string; links: string[] }> {
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'links'],
      onlyMainContent: false,
      waitFor: 3000,
      timeout: 30000,
    }),
  });
  if (!res.ok) return { markdown: '', links: [] };
  const data = await res.json();
  const d = data.data || data;
  return { markdown: d.markdown || '', links: (d.links || []).filter((l: unknown) => typeof l === 'string') };
}

// ---------- Deep-nav crawl (kwestiasmaku-style sites) ----------

async function deepNavCrawl(
  apiKey: string,
  baseUrl: string,
  maxSeeds: number,
): Promise<Array<{ url: string; title: string }>> {
  const base = new URL(baseUrl);
  const host = base.hostname.replace(/^www\./, '');

  // 1. Scrape homepage to discover category/tag seed pages
  const home = await firecrawlScrapeMarkdown(apiKey, baseUrl);

  const seedSet = new Set<string>();
  const seedPatterns: RegExp[] = [];

  if (host === 'kwestiasmaku.com') {
    seedPatterns.push(
      /https?:\/\/[^\s)"']*kwestiasmaku\.com\/przepisy\/[a-z0-9_-]+/gi,
      /https?:\/\/[^\s)"']*kwestiasmaku\.com\/[a-z_]+\/przepisy\.html/gi,
      /https?:\/\/[^\s)"']*kwestiasmaku\.com\/blog-kulinarny\/category\/[a-z0-9/_-]+/gi,
    );
  }

  for (const re of seedPatterns) {
    const matches = home.markdown.match(re) || [];
    for (const m of matches) seedSet.add(m.replace(/[)\].,;]+$/, '').replace(/\/$/, ''));
  }
  for (const l of home.links) {
    if (!l.includes(host)) continue;
    if (seedPatterns.some((re) => re.test(l))) seedSet.add(l.replace(/\/$/, ''));
  }

  const seeds = Array.from(seedSet).slice(0, maxSeeds);
  console.log(`Deep crawl: ${seeds.length} seed pages discovered for ${host}`);

  // 2. Scrape each seed in parallel batches, collecting recipe URLs
  const recipeMap = new Map<string, string>(); // url -> title (derived later)
  const BATCH = 6;
  for (let i = 0; i < seeds.length; i += BATCH) {
    const batch = seeds.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((s) => firecrawlScrapeLinks(apiKey, s)));
    for (const links of results) {
      for (const l of links) {
        const clean = l.split('#')[0].split('?')[0];
        if (isRecipeUrl(clean, baseUrl)) {
          const norm = clean.replace(/\/$/, '');
          if (!recipeMap.has(norm)) recipeMap.set(norm, '');
        }
      }
    }
    console.log(`  [${Math.min(i + BATCH, seeds.length)}/${seeds.length}] recipes so far: ${recipeMap.size}`);
  }

  return Array.from(recipeMap.entries()).map(([url, title]) => ({ url, title }));
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { source_id, limit } = await req.json().catch(() => ({}));
    if (!source_id) {
      return new Response(JSON.stringify({ error: 'source_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: source, error: sourceErr } = await admin
      .from('recipe_sources')
      .select('*')
      .eq('id', source_id)
      .maybeSingle();

    if (sourceErr || !source) {
      return new Response(JSON.stringify({ error: 'Source not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mapLimit = Math.min(Math.max(Number(limit) || 5000, 50), 30000);
    const host = new URL(source.base_url).hostname.replace(/^www\./, '');

    // Choose strategy: deep-nav crawl for kwestiasmaku, sitemap map for others.
    const useDeepCrawl = host === 'kwestiasmaku.com';

    let candidates: Array<{ url: string; title: string }> = [];

    if (useDeepCrawl) {
      candidates = await deepNavCrawl(firecrawlKey, source.base_url, 100);
    } else {
      const links = await firecrawlMap(firecrawlKey, source.base_url, mapLimit);
      const seen = new Set<string>();
      for (const url of links) {
        if (!isRecipeUrl(url, source.base_url)) continue;
        const norm = url.split('#')[0].split('?')[0].replace(/\/$/, '');
        if (seen.has(norm)) continue;
        seen.add(norm);
        candidates.push({ url: norm, title: '' });
      }
    }

    // Build rows and upsert
    const rows = candidates.map((c) => ({
      source_id: source.id,
      source_url: c.url,
      title: (c.title && c.title.trim()) || deriveTitleFromUrl(c.url),
    }));

    let inserted = 0;
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error: upErr, count } = await admin
          .from('scraped_recipes')
          .upsert(chunk, { onConflict: 'source_url', ignoreDuplicates: true, count: 'exact' });
        if (upErr) {
          console.error('Upsert error:', upErr);
        } else if (count) {
          inserted += count;
        }
      }
    }

    const { count: totalCount } = await admin
      .from('scraped_recipes')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', source.id);

    await admin
      .from('recipe_sources')
      .update({
        last_crawled_at: new Date().toISOString(),
        recipe_count: totalCount || 0,
      })
      .eq('id', source.id);

    return new Response(
      JSON.stringify({
        success: true,
        source: source.name,
        strategy: useDeepCrawl ? 'deep-nav-crawl' : 'sitemap-map',
        candidates_found: candidates.length,
        new_indexed: inserted,
        total_in_source: totalCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('crawl-recipe-source error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

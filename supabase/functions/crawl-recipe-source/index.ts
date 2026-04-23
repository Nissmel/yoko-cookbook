// Crawl a recipe blog (Firecrawl /v2/map) and index recipe titles + URLs
// into the public.scraped_recipes table.
//
// Auth: requires logged-in user (any authenticated user can trigger a crawl).
// Idempotent: dedupe via unique source_url (uses upsert with ignoreDuplicates).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Per-domain heuristics: which URL paths look like an individual recipe page.
// We keep these conservative — better miss a page than spam shopping/category pages.
function isRecipeUrl(url: string, baseUrl: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) return false;

    const path = u.pathname.toLowerCase();

    // Reject obvious non-recipe sections (junk pages, tags, sitemaps)
    const rejectPatterns = [
      /^\/?$/,
      /^\/(tag|tagi|kategoria|kategorie|category|categories|autor|author|kontakt|contact|o-(mnie|nas)|polityka|regulamin|sklep|shop|cart|koszyk|search|szukaj|page|strona|konto|account|login|logowanie|rejestracja|newsletter|drukuj|info|ranking|ksiega|zdjecia)\b/,
      /\.(jpg|jpeg|png|gif|webp|svg|pdf|xml|json|css|js|ico)$/,
      /^\/feed\b/,
      /^\/wp-/,
      /\/fav_category\b/,
      /\/przepisy-uzytkownikow\b/, // user-submitted, low quality
      /-sitemap/,
    ];
    if (rejectPatterns.some((re) => re.test(path))) return false;

    // Slug pattern: lowercase letters, digits, hyphens, underscores, URL-encoded chars (%XX)
    const SLUG = '[a-z0-9\\-_%]+';

    // Domain-specific accept rules
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'kwestiasmaku.com') {
      // /przepis/<slug>  OR  /przepisy/<slug>  OR  /blog-kulinarny/<slug>  OR  /dania/<cat>/<slug>
      const re = new RegExp(
        `^\\/(przepis|przepisy|blog-kulinarny)\\/${SLUG}\\/?$|^\\/dania\\/${SLUG}\\/${SLUG}\\/?$`,
      );
      return re.test(path);
    }

    if (host === 'aniagotuje.pl') {
      // /przepis/<slug>
      return new RegExp(`^\\/przepis\\/${SLUG}\\/?$`).test(path);
    }

    if (host === 'mojewypieki.com') {
      // /przepis/<slug>  (excluding /przepis/fav_category etc., already rejected above)
      return new RegExp(`^\\/przepis\\/${SLUG}\\/?$`).test(path);
    }

    // Generic fallback: path contains "przepis" or "recipe" and a slug
    return new RegExp(`\\/(przepis|przepisy|recipe|recipes)\\/${SLUG}`, 'i').test(path);
  } catch {
    return false;
  }
}

function deriveTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop() || '';
    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/\.html?$/i, '')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

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

    // Verify caller is logged in
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

    // Load source
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

    // Firecrawl /v2/map — use sitemap "include" so we get full coverage,
    // not just links discovered from the homepage.
    const mapRes = await fetch('https://api.firecrawl.dev/v2/map', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: source.base_url,
        limit: mapLimit,
        includeSubdomains: false,
        sitemap: 'include',
      }),
    });

    const mapData = await mapRes.json();
    if (!mapRes.ok) {
      return new Response(
        JSON.stringify({ error: `Firecrawl map failed [${mapRes.status}]: ${JSON.stringify(mapData)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // v2 returns { success, links: [...] } — links can be strings or { url, title }
    const rawLinks: Array<string | { url: string; title?: string }> =
      mapData.links || mapData.data?.links || [];

    const candidates = rawLinks
      .map((l) => (typeof l === 'string' ? { url: l, title: '' } : { url: l.url, title: l.title || '' }))
      .filter((l) => l.url && isRecipeUrl(l.url, source.base_url));

    // Dedupe by URL within this batch
    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });

    // Build rows and upsert (ignore duplicates on source_url unique constraint)
    const rows = unique.map((c) => ({
      source_id: source.id,
      source_url: c.url,
      title: (c.title && c.title.trim()) || deriveTitleFromUrl(c.url),
    }));

    let inserted = 0;
    if (rows.length > 0) {
      // Insert in chunks of 500 to stay under request size limits
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

    // Recompute total recipe_count for the source
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

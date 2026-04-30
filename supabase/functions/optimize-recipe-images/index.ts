// Background migration: scans recipe-images bucket, downscales + WebP-converts
// any image larger than ~400 KB or wider than 1600px. Idempotent: re-running
// is cheap because already-optimized images are skipped.
//
// Triggered by pg_cron daily; also callable manually for one-off optimization.
// Uses Photon (Rust→WASM) — much more memory-efficient than pure-JS decoders.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { decode, Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_DIMENSION = 1600;
const SIZE_THRESHOLD = 400 * 1024;
// Process one image per invocation — large phone photos can use ~150 MB during decode.
// Cron runs daily; with low recipe-add rate this is plenty.
const BATCH_LIMIT = 1;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // List recipes that still have non-webp or potentially large images.
    // We can't filter by file size in the recipes table, so we look at the URL extension.
    const { data: recipes, error: recipesErr } = await admin
      .from('recipes')
      .select('id, image_url, user_id')
      .not('image_url', 'is', null)
      .not('image_url', 'ilike', '%.webp')
      .limit(BATCH_LIMIT);

    if (recipesErr) throw recipesErr;

    const results: Array<{ id: string; status: string; from?: number; to?: number; error?: string }> = [];

    for (const recipe of recipes ?? []) {
      try {
        const url: string = recipe.image_url;
        // Extract storage path: .../recipe-images/<userId>/<file>
        const marker = '/recipe-images/';
        const idx = url.indexOf(marker);
        if (idx === -1) {
          results.push({ id: recipe.id, status: 'skipped-external' });
          continue;
        }
        const storagePath = decodeURIComponent(url.substring(idx + marker.length).split('?')[0]);

        const { data: blob, error: dlErr } = await admin.storage
          .from('recipe-images')
          .download(storagePath);
        if (dlErr || !blob) {
          results.push({ id: recipe.id, status: 'download-failed', error: dlErr?.message });
          continue;
        }

        const originalSize = blob.size;
        const buffer = new Uint8Array(await blob.arrayBuffer());

        let img: Image;
        try {
          const decoded = await decode(buffer);
          if (!(decoded instanceof Image)) {
            results.push({ id: recipe.id, status: 'skipped-animated' });
            continue;
          }
          img = decoded;
        } catch (decodeErr) {
          results.push({ id: recipe.id, status: 'decode-failed', error: String(decodeErr) });
          continue;
        }

        const longest = Math.max(img.width, img.height);
        const needsResize = longest > MAX_DIMENSION;
        const isAlreadySmall = originalSize < SIZE_THRESHOLD && !needsResize;

        if (isAlreadySmall) {
          results.push({ id: recipe.id, status: 'already-optimal', from: originalSize });
          continue;
        }

        if (needsResize) {
          const scale = MAX_DIMENSION / longest;
          img.resize(Math.round(img.width * scale), Math.round(img.height * scale));
        }

        // imagescript supports WebP encoding via .encodeWEBP() in 1.2.17+
        let encoded: Uint8Array;
        try {
          encoded = await (img as any).encodeWEBP(80);
        } catch {
          encoded = await img.encodeJPEG(85);
        }

        if (encoded.length >= originalSize * 0.95) {
          results.push({ id: recipe.id, status: 'no-savings', from: originalSize, to: encoded.length });
          continue;
        }

        // Upload as new file (preserve old briefly in case of rollback need)
        const newPath = `${recipe.user_id}/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await admin.storage
          .from('recipe-images')
          .upload(newPath, encoded, { contentType: 'image/webp', upsert: false });
        if (upErr) {
          results.push({ id: recipe.id, status: 'upload-failed', error: upErr.message });
          continue;
        }

        const { data: pub } = admin.storage.from('recipe-images').getPublicUrl(newPath);

        const { error: updErr } = await admin
          .from('recipes')
          .update({ image_url: pub.publicUrl })
          .eq('id', recipe.id);
        if (updErr) {
          // cleanup new upload
          await admin.storage.from('recipe-images').remove([newPath]);
          results.push({ id: recipe.id, status: 'db-update-failed', error: updErr.message });
          continue;
        }

        // Delete old file
        await admin.storage.from('recipe-images').remove([storagePath]);

        results.push({ id: recipe.id, status: 'optimized', from: originalSize, to: encoded.length });
      } catch (err) {
        results.push({ id: recipe.id, status: 'error', error: String(err) });
      }
    }

    const summary = {
      processed: results.length,
      optimized: results.filter((r) => r.status === 'optimized').length,
      skipped: results.filter((r) => r.status.startsWith('skipped') || r.status === 'already-optimal' || r.status === 'no-savings').length,
      errors: results.filter((r) => r.status.includes('failed') || r.status === 'error').length,
      bytes_saved: results
        .filter((r) => r.status === 'optimized' && r.from && r.to)
        .reduce((acc, r) => acc + (r.from! - r.to!), 0),
      results,
    };

    console.log('Image optimization batch complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('optimize-recipe-images failed:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

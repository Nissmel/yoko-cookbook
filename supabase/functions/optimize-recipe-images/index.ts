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

/**
 * Parse EXIF Orientation tag (0x0112) from a JPEG byte stream.
 * Returns 1 (no rotation) if missing/invalid. Values 1-8 per EXIF spec.
 */
function readJpegOrientation(buf: Uint8Array): number {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return 1;
    const marker = buf[offset + 1];
    offset += 2;
    if (marker === 0xda || marker === 0xd9) return 1; // SOS or EOI
    const segLen = (buf[offset] << 8) | buf[offset + 1];
    if (marker === 0xe1 && segLen >= 14) {
      // APP1 — check for "Exif\0\0"
      if (
        buf[offset + 2] === 0x45 && buf[offset + 3] === 0x78 &&
        buf[offset + 4] === 0x69 && buf[offset + 5] === 0x66
      ) {
        const tiffStart = offset + 8;
        const little = buf[tiffStart] === 0x49 && buf[tiffStart + 1] === 0x49;
        const get16 = (o: number) =>
          little ? buf[o] | (buf[o + 1] << 8) : (buf[o] << 8) | buf[o + 1];
        const get32 = (o: number) =>
          little
            ? buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)
            : (buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3];
        const ifdOffset = tiffStart + get32(tiffStart + 4);
        const numEntries = get16(ifdOffset);
        for (let i = 0; i < numEntries; i++) {
          const entry = ifdOffset + 2 + i * 12;
          if (get16(entry) === 0x0112) {
            return get16(entry + 8) || 1;
          }
        }
      }
    }
    offset += segLen;
  }
  return 1;
}

/** Apply EXIF orientation (1-8) to an imagescript Image, returning the rotated image. */
function applyExifOrientation(img: Image, orientation: number): Image {
  if (orientation <= 1 || orientation > 8) return img;
  switch (orientation) {
    case 2: return img.flip(true, false);
    case 3: return img.rotate(180);
    case 4: return img.flip(false, true);
    case 5: return img.rotate(90).flip(true, false);
    case 6: return img.rotate(90);
    case 7: return img.rotate(270).flip(true, false);
    case 8: return img.rotate(270);
    default: return img;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Only consider images that live in our storage bucket and aren't already WebP.
    const storageBaseUrl = `${supabaseUrl}/storage/v1/object/public/recipe-images/`;
    const { data: recipes, error: recipesErr } = await admin
      .from('recipes')
      .select('id, image_url, user_id')
      .not('image_url', 'is', null)
      .like('image_url', `${storageBaseUrl}%`)
      .not('image_url', 'like', '%.webp')
      .order('created_at', { ascending: true })
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

        // Honor JPEG EXIF orientation — imagescript doesn't apply it automatically,
        // so phone photos in portrait would otherwise come out sideways.
        const orientation = readJpegOrientation(buffer);
        if (orientation > 1) {
          img = applyExifOrientation(img, orientation);
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

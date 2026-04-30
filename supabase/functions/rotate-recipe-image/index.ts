// One-shot rotation fix for already-optimized images that lost EXIF orientation
// before the fix landed. Downloads, rotates 90° CCW (counter-clockwise), re-uploads.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { decode, Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { recipe_id, degrees = 270 } = await req.json(); // 270 = rotate 90° CCW
    if (!recipe_id) {
      return new Response(JSON.stringify({ error: 'recipe_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: recipe, error: rErr } = await admin
      .from('recipes').select('id, image_url, user_id').eq('id', recipe_id).single();
    if (rErr || !recipe?.image_url) throw rErr || new Error('Recipe has no image');

    const marker = '/recipe-images/';
    const idx = recipe.image_url.indexOf(marker);
    if (idx === -1) throw new Error('Image is not in storage bucket');
    const oldPath = decodeURIComponent(recipe.image_url.substring(idx + marker.length).split('?')[0]);

    const { data: blob, error: dlErr } = await admin.storage
      .from('recipe-images').download(oldPath);
    if (dlErr || !blob) throw dlErr || new Error('Download failed');

    const decoded = await decode(new Uint8Array(await blob.arrayBuffer()));
    if (!(decoded instanceof Image)) throw new Error('Not a still image');

    decoded.rotate(degrees);
    let encoded: Uint8Array;
    try {
      encoded = await (decoded as any).encodeWEBP(80);
    } catch {
      encoded = await decoded.encodeJPEG(85);
    }

    const newPath = `${recipe.user_id}/${crypto.randomUUID()}.webp`;
    const { error: upErr } = await admin.storage
      .from('recipe-images').upload(newPath, encoded, { contentType: 'image/webp' });
    if (upErr) throw upErr;

    const { data: pub } = admin.storage.from('recipe-images').getPublicUrl(newPath);
    const { error: updErr } = await admin
      .from('recipes').update({ image_url: pub.publicUrl }).eq('id', recipe_id);
    if (updErr) {
      await admin.storage.from('recipe-images').remove([newPath]);
      throw updErr;
    }
    await admin.storage.from('recipe-images').remove([oldPath]);

    return new Response(JSON.stringify({ success: true, new_url: pub.publicUrl, degrees }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

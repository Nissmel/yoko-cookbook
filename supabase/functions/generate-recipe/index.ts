// Generate a recipe via AI, using random titles from scraped_recipes as inspiration
// to avoid the "always the same 5 recipes" problem.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, category } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: 'Title required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pull a random sample of indexed recipe titles as inspiration
    let inspirationBlock = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey);
        // Fetch a wider pool, then sample client-side for true randomness
        const { data: pool } = await admin
          .from('scraped_recipes')
          .select('title, source_url')
          .limit(500);
        if (pool && pool.length > 0) {
          const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 12);
          inspirationBlock = `\n\nDla inspiracji — oto kilka prawdziwych przepisów z polskich blogów kulinarnych. NIE kopiuj ich dokładnie, ale zainspiruj się stylem, składnikami i technikami:\n${shuffled.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}`;
        }
      }
    } catch (err) {
      console.warn('Could not fetch inspiration pool:', err);
    }

    const systemPrompt = `You are a professional chef. Generate a complete recipe based on the given title and description.

Rules:
- Use ONLY metric units (grams, ml, liters, °C).
- Write ingredient names and instructions in Polish.
- Be specific with quantities and steps.
- In instructions, every reference to an ingredient MUST be wrapped in double square brackets with quantity, unit, and name, e.g. "Dodaj [[150 g mąki pszennej]] i wymieszaj z [[200 ml mleka]]." Ingredients without exact amounts (sól do smaku, pieprz) MUST also be wrapped: "[[sól do smaku]]". This is required for the app's scaling feature.
- Be CREATIVE and avoid repetitive, generic recipes — vary techniques, ingredients, and flavor profiles.
- Return ONLY valid JSON, no markdown.

JSON structure:
{
  "title": "string",
  "description": "string",
  "category": "string",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "ingredients": [{"name": "string", "quantity": "string", "unit": "string"}],
  "instructions": ["step1", "step2", ...],
  "calories_per_serving": number,
  "protein_grams": number,
  "carbs_grams": number,
  "fat_grams": number,
  "fiber_grams": number,
  "tags": ["tag1", "tag2"]
}`;

    const userMsg = `Generate a full recipe for: "${title}"${description ? `\nDescription: ${description}` : ''}${category ? `\nCategory: ${category}` : ''}${inspirationBlock}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limited, please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiRes.ok) {
      return new Response(JSON.stringify({ error: `AI error: ${aiRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const recipe = JSON.parse(content);

    return new Response(JSON.stringify({ success: true, recipe }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

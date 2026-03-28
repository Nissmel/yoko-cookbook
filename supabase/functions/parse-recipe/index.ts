import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { markdown, title: pageTitle, source_url } = await req.json();
    if (!markdown) {
      return new Response(JSON.stringify({ error: 'Markdown content required' }), {
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

    const systemPrompt = `You are a recipe parser. Extract recipe data from the provided text and return ONLY valid JSON with this exact structure:
{
  "title": "string",
  "description": "string or null",
  "servings": number,
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "category": "one of: Breakfast, Lunch, Dinner, Appetizer, Dessert, Snack, Beverage, Soup, Salad, Side Dish" or null,
  "tags": ["string array"],
  "ingredients": [{"name": "string", "quantity": "string", "unit": "string"}],
  "instructions": ["step 1", "step 2"],
  "calories_per_serving": number or null,
  "protein_grams": number or null,
  "carbs_grams": number or null,
  "fat_grams": number or null,
  "fiber_grams": number or null,
  "image_url": "string or null"
}
Return ONLY the JSON object, no markdown formatting, no code blocks.`;

    const aiRes = await fetch('https://ai.lovable.dev/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Page title: ${pageTitle || 'Unknown'}\n\nContent:\n${markdown.substring(0, 8000)}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errData = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI parsing failed: ${aiRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || '';
    
    // Clean potential markdown code blocks
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const recipe = JSON.parse(content);
    recipe.source_url = source_url;

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

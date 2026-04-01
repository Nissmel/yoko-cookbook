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
    const { markdown, title: pageTitle, source_url, extra_instructions } = await req.json();
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

    const systemPrompt = `You are a recipe parser that extracts structured recipe data from web pages. Rules:
- Use ONLY metric units (grams, ml, liters, °C). Convert cups, tablespoons, ounces, fahrenheit etc. to metric.
- Ingredient names and instructions MUST be in Polish.
- In instructions, reference ingredients by name with amounts (e.g. "Dodaj 150g mąki pszennej i wymieszaj").
- Each ingredient MUST have a "category" field with one of: "Nabiał i Jajka", "Mięso i Drób", "Ryby i Owoce Morza", "Owoce", "Warzywa", "Pieczywo", "Makarony i Kasze", "Konserwy i Słoiki", "Oleje i Sosy", "Przyprawy", "Do Pieczenia", "Mrożonki", "Napoje", "Przekąski i Orzechy", "Inne".
- calories_per_serving is for ONE serving. Calculate if not provided.
- Extract ALL instructions as detailed steps, not summaries.
- If ingredients are listed as baker's percentages, convert them to actual gram amounts for the given recipe yield.
- Return ONLY valid JSON, no markdown, no code blocks.

JSON structure:
{
  "title": "string",
  "description": "string or null",
  "servings": number,
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "category": "one of: Breakfast, Lunch, Dinner, Appetizer, Dessert, Snack, Beverage, Soup, Salad, Side Dish" or null,
  "tags": ["tagi po polsku"],
  "ingredients": [{"name": "Polish name", "quantity": "number as string", "unit": "g/ml/etc", "category": "store section"}],
  "instructions": ["detailed step in Polish with ingredient amounts"],
  "calories_per_serving": number or null,
  "protein_grams": number or null,
  "carbs_grams": number or null,
  "fat_grams": number or null,
  "fiber_grams": number or null,
  "image_url": "string or null"
}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Page title: ${pageTitle || 'Unknown'}\n\nExtract the full recipe from this page content:\n${markdown.substring(0, 15000)}` },
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

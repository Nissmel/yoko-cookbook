const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipes, days, preferences } = await req.json();
    if (!recipes || !days) {
      return new Response(JSON.stringify({ error: 'Recipes and days required' }), {
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

    const recipeSummaries = recipes.map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      calories: r.calories_per_serving,
      servings: r.servings,
      tags: r.tags,
    }));

    const systemPrompt = `You are a meal planning assistant. Given a list of available recipes, create a meal plan.

Available recipes:
${JSON.stringify(recipeSummaries, null, 2)}

Rules:
- Plan for ${days} days (starting from day 1).
- Each day should have breakfast, lunch, and dinner.
- Try to vary meals — avoid repeating the same recipe on consecutive days.
- Match recipe categories to meal types when possible (Breakfast→breakfast, Soup/Salad→lunch, Dinner→dinner).
- If a recipe doesn't fit any meal type, use it for dinner.
${preferences ? `- User preferences: ${preferences}` : ''}
- Return ONLY valid JSON, no markdown, no code blocks.

JSON structure:
{
  "plan": [
    {
      "day": 1,
      "meals": {
        "breakfast": { "recipe_id": "uuid", "recipe_title": "name" },
        "lunch": { "recipe_id": "uuid", "recipe_title": "name" },
        "dinner": { "recipe_id": "uuid", "recipe_title": "name" }
      }
    }
  ]
}

Use ONLY recipe IDs from the provided list. If there aren't enough recipes, you can repeat some but try to minimize repetition.`;

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
          { role: 'user', content: 'Generate the meal plan now.' },
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

    const plan = JSON.parse(content);

    return new Response(JSON.stringify({ success: true, ...plan }), {
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

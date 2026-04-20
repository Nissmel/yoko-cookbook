const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipes, days, preferences, singleSlot, exclude } = await req.json();
    if (!days && !singleSlot) {
      return new Response(JSON.stringify({ error: 'Days or singleSlot required' }), {
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

    const existingRecipes = (recipes || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category,
    }));

    const mealLabelMap: Record<string, string> = {
      breakfast: 'Śniadanie',
      lunch: 'Obiad',
      dinner: 'Kolacja',
      dessert: 'Deser',
    };

    const systemPrompt = singleSlot
      ? `You are a creative meal planning assistant. Generate FRESH options for a SINGLE meal slot.

${existingRecipes.length > 0 ? `The user has these recipes in their cookbook:\n${JSON.stringify(existingRecipes, null, 2)}\n` : 'The user has no recipes yet.'}

Slot: ${mealLabelMap[singleSlot.mealType] || singleSlot.mealType} (day ${singleSlot.day})
${exclude?.length ? `AVOID these titles (already shown, user did not like them):\n${exclude.map((t: string) => `- ${t}`).join('\n')}\n` : ''}

Rules:
- Provide exactly 4 NEW options for this single meal slot.
- Mix existing cookbook recipes (mark "source": "existing", include "recipe_id") with NEW recipe ideas (mark "source": "new").
- For new recipes include: title, short description (1 sentence), category (Śniadanie/Obiad/Kolacja/Zupa/Sałatka/Deser/Przekąska/Przystawka), prep_time_minutes, cook_time_minutes.
- New recipe titles must be specific and appetizing in Polish.
- Be CREATIVE and DIFFERENT from any excluded titles.
${preferences ? `- User preferences: ${preferences}` : ''}
- Return ONLY valid JSON, no markdown.

JSON structure:
{
  "options": [
    { "source": "existing", "recipe_id": "uuid", "title": "name" },
    { "source": "new", "title": "...", "description": "...", "category": "...", "prep_time_minutes": 10, "cook_time_minutes": 15 }
  ]
}`
      : `You are a creative meal planning assistant. Generate a meal plan with MULTIPLE OPTIONS per meal slot so the user can choose.

${existingRecipes.length > 0 ? `The user has these recipes in their cookbook:\n${JSON.stringify(existingRecipes, null, 2)}\n` : 'The user has no recipes yet.'}

Rules:
- Plan for ${days} days.
- Each day has 4 meal types: breakfast (Śniadanie), lunch (Obiad), dinner (Kolacja), dessert (Deser).
- For EACH meal slot, provide exactly 4 options.
- Mix existing cookbook recipes (mark with "source": "existing" and include their "recipe_id") with NEW recipe ideas you invent (mark with "source": "new").
- For new recipes, include: title, short description (1 sentence), estimated category (Śniadanie/Obiad/Kolacja/Zupa/Sałatka/Deser/Przekąska/Przystawka), estimated prep_time_minutes, cook_time_minutes.
- Try to have at least 1-2 existing recipes per slot (if available) and 2-3 new ideas.
- New recipe titles should be specific and appetizing (e.g. "Kremowa zupa z pieczonych pomidorów" not just "Soup").
- For dessert slot, suggest things like ciasta, mus, lody, tarty, deser na łyżeczce, fit desery itp.
- Keep names in Polish.

BATCH COOKING / LEFTOVERS (IMPORTANT):
- For lunch (Obiad) and dinner (Kolacja) slots, INCLUDE 1-2 "batch cooking" suggestions across the week — bigger dishes that naturally yield 2 servings worth and taste great reheated the next day.
- Good batch examples: gulasz, bigos, lasagne, zapiekanki, zupy (pomidorowa, gulaszowa, rosół), pieczeń, curry, chili con carne, risotto na większą porcję, leczo, makarony zapiekane.
- When you propose such a dish on day N, ALSO include the SAME option in day N+1 in the same meal slot (lunch or dinner) — but mark it with "leftover_from_day": N and prefix the title with "♻️ " and add a short note in description like "Z wczorajszego obiadu — odgrzej i podawaj.".
- The leftover option can be "source": "new" with the same title (without ♻️) referenced via "leftover_title", OR "source": "existing" with the same recipe_id. Either way set "leftover_from_day".
- Don't overdo it: at most 2 leftover pairs per week. Other 2-3 options in the slot should still be fresh ideas so user can choose.
- Never put leftovers in breakfast or dessert.
${preferences ? `- User preferences: ${preferences}` : ''}
- Return ONLY valid JSON, no markdown.

JSON structure:
{
  "plan": [
    {
      "day": 1,
      "meals": {
        "breakfast": {
          "options": [
            { "source": "existing", "recipe_id": "uuid", "title": "name" },
            { "source": "new", "title": "New Recipe Name", "description": "Short desc", "category": "Śniadanie", "prep_time_minutes": 10, "cook_time_minutes": 15 }
          ]
        },
        "lunch": { "options": [
          { "source": "new", "title": "Gulasz wołowy z papryką", "description": "Duża porcja na 2 dni", "category": "Obiad", "prep_time_minutes": 20, "cook_time_minutes": 90, "batch_cooking": true }
        ] },
        "dinner": { "options": [...] },
        "dessert": { "options": [...] }
      }
    },
    {
      "day": 2,
      "meals": {
        "lunch": { "options": [
          { "source": "new", "title": "♻️ Gulasz wołowy z papryką", "description": "Z wczorajszego obiadu — odgrzej i podawaj.", "category": "Obiad", "leftover_from_day": 1 }
        ] }
      }
    }
  ]
}`;

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
          { role: 'user', content: singleSlot ? 'Generate 4 fresh options for this single meal slot now.' : 'Generate the meal plan now with multiple options per meal.' },
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

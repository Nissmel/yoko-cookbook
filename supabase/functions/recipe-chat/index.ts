const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, recipe, mode } = await req.json();
    if (!message || !recipe) {
      return new Response(JSON.stringify({ error: 'Message and recipe required' }), {
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

    const isEditMode = mode === 'edit';

    const systemPrompt = isEditMode
      ? `You are a recipe modification assistant. The user wants to modify an existing recipe.

Current recipe:
Title: ${recipe.title}
Description: ${recipe.description || 'N/A'}
Servings: ${recipe.servings}
Category: ${recipe.category || 'N/A'}
Prep time: ${recipe.prep_time_minutes || 'N/A'} min
Cook time: ${recipe.cook_time_minutes || 'N/A'} min
Ingredients: ${JSON.stringify(recipe.ingredients)}
Instructions: ${JSON.stringify(recipe.instructions)}
Calories per serving: ${recipe.calories_per_serving || 'N/A'}

Rules:
- Apply the requested modification to the recipe.
- Use ONLY metric units (grams, ml, liters, °C).
- Keep ingredient names and instructions in Polish.
- In instructions, every reference to an ingredient MUST be wrapped in double square brackets with quantity, unit, and name, e.g. "Dodaj [[150 g mąki]] i wymieszaj z [[200 ml mleka]]." Ingredients without exact amounts (sól do smaku, pieprz) MUST also be wrapped: "[[sól do smaku]]". Preserve existing [[...]] markup when modifying steps.
- Return the modified recipe as JSON with these fields:
  title, description, servings, category, prep_time_minutes, cook_time_minutes,
  ingredients (array of {name, quantity, unit}), instructions (array of strings),
  calories_per_serving, protein_grams, carbs_grams, fat_grams, fiber_grams, tags (array of strings)
- Also include a "summary" field explaining what was changed.
- Return ONLY valid JSON, no markdown, no code blocks.`
      : `You are a helpful cooking assistant. The user is viewing a recipe and may ask questions about it, request modifications, substitutions, tips, or related suggestions.

Current recipe:
Title: ${recipe.title}
Description: ${recipe.description || 'N/A'}
Servings: ${recipe.servings}
Category: ${recipe.category || 'N/A'}
Prep time: ${recipe.prep_time_minutes || 'N/A'} min
Cook time: ${recipe.cook_time_minutes || 'N/A'} min
Ingredients: ${JSON.stringify(recipe.ingredients)}
Instructions: ${JSON.stringify(recipe.instructions)}
Calories per serving: ${recipe.calories_per_serving || 'N/A'}

Rules:
- Answer in the same language the user writes in.
- Be concise but helpful.
- If the user asks for modifications, provide clear updated ingredients/instructions.
- You can suggest tips, substitutions, pairings, and variations.`;

    const requestBody: any = {
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    };

    if (isEditMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
    const content = aiData.choices?.[0]?.message?.content || 'No response';

    if (isEditMode) {
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const modifiedRecipe = JSON.parse(cleaned);
        return new Response(JSON.stringify({ response: modifiedRecipe.summary || 'Recipe modified', modified_recipe: modifiedRecipe }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to parse modified recipe' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ response: content }), {
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

// Edge function: cook-suggestions
// Given a list of ingredients the user has, returns:
// 1) ranked matches from their existing recipes (server-side)
// 2) AI-generated NEW recipe ideas in Polish via Lovable AI Gateway

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[ąà]/g, "a")
    .replace(/[ćč]/g, "c")
    .replace(/[ęè]/g, "e")
    .replace(/[łl]/g, "l")
    .replace(/[ńñ]/g, "n")
    .replace(/[óò]/g, "o")
    .replace(/[śš]/g, "s")
    .replace(/[źżž]/g, "z");
}

function ingMatch(have: string, recipeIng: string): boolean {
  const h = normalize(have);
  const r = normalize(recipeIng);
  return r.includes(h) || h.includes(r);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json();
    const ingredients: string[] = Array.isArray(body?.ingredients) ? body.ingredients : [];
    if (ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "No ingredients provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Match against user's own recipes
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recipes } = await supabase
      .from("recipes")
      .select("id, title, image_url, category, ingredients")
      .eq("user_id", userId);

    const matchedRecipes = (recipes ?? [])
      .map((r: any) => {
        const ings: any[] = Array.isArray(r.ingredients) ? r.ingredients : [];
        const matched: string[] = [];
        const missing: string[] = [];
        ings.forEach((ing: any) => {
          const name = typeof ing === "string" ? ing : ing.name;
          if (!name) return;
          const has = ingredients.some((i) => ingMatch(i, name));
          if (has) matched.push(name);
          else missing.push(name);
        });
        const total = matched.length + missing.length;
        const pct = total > 0 ? Math.round((matched.length / total) * 100) : 0;
        return {
          id: r.id,
          title: r.title,
          image_url: r.image_url,
          category: r.category,
          matched,
          missing: missing.slice(0, 8),
          missingCount: missing.length,
          matchPercent: pct,
        };
      })
      .filter((r) => r.matchPercent >= 30)
      .sort((a, b) => b.matchPercent - a.matchPercent)
      .slice(0, 8);

    // 2) AI suggestions for NEW recipes (Polish)
    const systemPrompt = `Jesteś asystentem kulinarnym. Użytkownik podaje listę składników, które ma w domu.
Twoim zadaniem jest zaproponować 3-4 NOWE pomysły na danie, które można z nich zrobić (możesz założyć, że ma podstawowe przyprawy: sól, pieprz, oliwę, masło, cukier, mąkę).
Odpowiadaj WYŁĄCZNIE po polsku. Bądź konkretny i zwięzły.`;

    const userPrompt = `Mam: ${ingredients.join(", ")}.

Zaproponuj 3-4 dania. Dla każdego: tytuł (krótki, max 6 słów), 1-zdaniowy opis, lista składników z mojej listy które wykorzystuje, lista BRAKUJĄCYCH składników (1-4 sztuk), szacowany czas w minutach, poziom trudności (Łatwe/Średnie/Trudne).`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_recipes",
              description: "Return 3-4 new recipe ideas",
              parameters: {
                type: "object",
                properties: {
                  ideas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        usedIngredients: { type: "array", items: { type: "string" } },
                        missingIngredients: { type: "array", items: { type: "string" } },
                        timeMinutes: { type: "number" },
                        difficulty: { type: "string", enum: ["Łatwe", "Średnie", "Trudne"] },
                      },
                      required: [
                        "title",
                        "description",
                        "usedIngredients",
                        "missingIngredients",
                        "timeMinutes",
                        "difficulty",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["ideas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_recipes" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    let ideas: any[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        ideas = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
      } catch (e) {
        console.error("Failed to parse AI tool args:", e);
      }
    }

    return new Response(
      JSON.stringify({ matchedRecipes, ideas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("cook-suggestions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

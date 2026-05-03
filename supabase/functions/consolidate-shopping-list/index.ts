// Consolidate (merge) shopping list items using AI.
// Takes the user's current unchecked items, asks the AI to group equivalent
// ingredients (e.g. "świeży koperek" + "koperek") and combine quantities
// across compatible units (g/kg, ml/l, łyżka/łyżeczka, garść → szacunkowe g).
// Returns groups of source item IDs + the merged ingredient.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface Item {
  id: string;
  ingredient_name: string;
  quantity: string | null;
  unit: string | null;
  recipe_id: string | null;
}

interface MergedGroup {
  source_ids: string[];
  ingredient_name: string;
  quantity: string | null;
  unit: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const ownerId: string = body.owner_id || user.id;

    // Fetch unchecked items for the target owner (RLS will block if not allowed)
    const { data: items, error } = await supabase
      .from('shopping_list_items')
      .select('id, ingredient_name, quantity, unit, recipe_id')
      .eq('user_id', ownerId)
      .eq('checked', false);

    if (error) throw error;
    if (!items || items.length < 2) {
      return new Response(JSON.stringify({ merged: 0, groups: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ask AI to consolidate
    const systemPrompt = `Jesteś asystentem konsolidującym listę zakupów po polsku.
Dostajesz tablicę pozycji listy zakupów. Twoim zadaniem jest:
1. Zgrupować pozycje, które są tym samym składnikiem (np. "świeży koperek" i "koperek", "cebula czerwona" i "cebula", "mąka pszenna" i "mąka").
2. Zsumować ilości wewnątrz grupy. Konwertuj jednostki gdzie to możliwe:
   - g ↔ kg (1000 g = 1 kg), ml ↔ l (1000 ml = 1 l)
   - łyżka ≈ 15 ml/g, łyżeczka ≈ 5 ml/g, szklanka ≈ 250 ml/g
   - garść / pęczek / szczypta zostaw jako osobne — DODAJ tekstowo (np. "1 garść + 20 g") jeśli nie da się przeliczyć
3. Wybierz najprostszą wspólną nazwę (bez przymiotników typu "świeży", "drobno posiekany").
4. Wybierz najsensowniejszą jednostkę docelową (zwykle g lub ml dla wagi/objętości).
5. Pomiń grupy, które zawierają tylko 1 pozycję — nie ma czego scalać.

Zwróć WYŁĄCZNIE JSON o strukturze:
{ "groups": [ { "source_ids": ["uuid1","uuid2"], "ingredient_name": "koperek", "quantity": "30", "unit": "g" } ] }

Nie dodawaj komentarzy, nie owijaj w \`\`\`.`;

    const userPrompt = `Pozycje do skonsolidowania:\n${JSON.stringify(items, null, 2)}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('AI error', aiRes.status, txt);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit, spróbuj za chwilę' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'Brak kredytów AI' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI request failed');
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || '{}';
    let parsed: { groups?: MergedGroup[] };
    try { parsed = JSON.parse(content); } catch { parsed = { groups: [] }; }
    const groups = (parsed.groups || []).filter(
      (g) => Array.isArray(g.source_ids) && g.source_ids.length >= 2,
    );

    if (groups.length === 0) {
      return new Response(JSON.stringify({ merged: 0, groups: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate IDs against fetched items, then apply: insert merged + delete sources.
    const validIds = new Set(items.map((i) => i.id));
    let mergedCount = 0;
    for (const g of groups) {
      const ids = g.source_ids.filter((id) => validIds.has(id));
      if (ids.length < 2) continue;

      // Pick a recipe_id from sources (first non-null) to keep "by recipe" grouping reasonable
      const sourceItems = items.filter((i) => ids.includes(i.id));
      const recipeId = sourceItems.find((i) => i.recipe_id)?.recipe_id ?? null;

      const { error: insErr } = await supabase
        .from('shopping_list_items')
        .insert({
          user_id: ownerId,
          ingredient_name: g.ingredient_name,
          quantity: g.quantity,
          unit: g.unit,
          recipe_id: recipeId,
          checked: false,
        });
      if (insErr) { console.error('insert merged failed', insErr); continue; }

      const { error: delErr } = await supabase
        .from('shopping_list_items')
        .delete()
        .in('id', ids);
      if (delErr) { console.error('delete sources failed', delErr); continue; }

      mergedCount += ids.length;
    }

    return new Response(JSON.stringify({ merged: mergedCount, groups: groups.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

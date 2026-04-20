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
      ? `Jesteś kreatywnym asystentem planowania posiłków. Wygeneruj ŚWIEŻE propozycje dla JEDNEGO slotu posiłkowego.

${existingRecipes.length > 0 ? `Użytkownik ma w swojej książce kucharskiej te przepisy:\n${JSON.stringify(existingRecipes, null, 2)}\n` : 'Użytkownik nie ma jeszcze żadnych przepisów.'}

Slot: ${mealLabelMap[singleSlot.mealType] || singleSlot.mealType} (dzień ${singleSlot.day})
${exclude?.length ? `UNIKAJ tych tytułów (już pokazane, użytkownikowi się nie spodobały):\n${exclude.map((t: string) => `- ${t}`).join('\n')}\n` : ''}

Zasady:
- Podaj dokładnie 4 NOWE propozycje dla tego slotu.
- Mieszaj istniejące przepisy z książki kucharskiej (oznacz "source": "existing", dołącz "recipe_id") z NOWYMI pomysłami (oznacz "source": "new").
- Dla nowych przepisów dołącz: title, krótki description (1 zdanie), category (Śniadanie/Obiad/Kolacja/Zupa/Sałatka/Deser/Przekąska/Przystawka), prep_time_minutes, cook_time_minutes.
- Tytuły nowych przepisów muszą być konkretne i apetyczne, PO POLSKU.
- WSKAZÓWKA dot. prostoty: większość propozycji powinna być codzienna i prosta (20-40 min), ale od czasu do czasu możesz zaproponować coś bardziej dopracowanego — byle nie cały plan był restauracyjny. Unikaj egzotycznych składników i technik typu sous-vide.
- RÓŻNORODNOŚĆ KUCHNI: użytkownik lubi nowości i dania z różnych kuchni świata (włoska, azjatycka, meksykańska, bliskowschodnia, indyjska, grecka, amerykańska itd.) — nie ograniczaj się do polskich. Mieszaj kuchnie w propozycjach, ale opisy i tytuły zawsze po polsku.
- Bądź KREATYWNY i RÓŻNY od wykluczonych tytułów, ale trzymaj się prostoty.
${preferences ? `- Preferencje użytkownika: ${preferences}` : ''}
- Zwróć WYŁĄCZNIE poprawny JSON, bez markdown.

Struktura JSON:
{
  "options": [
    { "source": "existing", "recipe_id": "uuid", "title": "nazwa" },
    { "source": "new", "title": "...", "description": "...", "category": "...", "prep_time_minutes": 10, "cook_time_minutes": 15 }
  ]
}`
      : `Jesteś kreatywnym asystentem planowania posiłków. Wygeneruj plan posiłków z WIELOMA OPCJAMI na każdy slot, żeby użytkownik mógł wybrać.

${existingRecipes.length > 0 ? `Użytkownik ma w swojej książce kucharskiej te przepisy:\n${JSON.stringify(existingRecipes, null, 2)}\n` : 'Użytkownik nie ma jeszcze żadnych przepisów.'}

Zasady:
- Plan na ${days} dni.
- Każdy dzień ma 4 typy posiłków: breakfast (Śniadanie), lunch (Obiad), dinner (Kolacja), dessert (Deser).
- Dla KAŻDEGO slotu podaj dokładnie 4 opcje.
- Mieszaj istniejące przepisy z książki kucharskiej (oznacz "source": "existing" i dołącz "recipe_id") z NOWYMI pomysłami (oznacz "source": "new").
- Dla nowych przepisów dołącz: title, krótki description (1 zdanie), szacunkową category (Śniadanie/Obiad/Kolacja/Zupa/Sałatka/Deser/Przekąska/Przystawka), szacunkowe prep_time_minutes, cook_time_minutes.
- Postaraj się dać 1-2 istniejące przepisy na slot (jeśli są) i 2-3 nowe pomysły.
- WSZYSTKO PO POLSKU — tytuły, opisy, kategorie. Bez angielskich słów.
- Tytuły konkretne i apetyczne (np. "Kremowa zupa pomidorowa z grzankami", nie samo "Zupa").
- Dla deseru: ciasta, mus, lody, tarty, deser na łyżeczce, fit desery itp.

WSKAZÓWKI dot. prostoty (NIE sztywne reguły):
- Większość propozycji niech będzie codzienna i prosta — dania, które da się zrobić w 20-40 minut.
- Możesz CZASEM (1-2 razy w tygodniu) zaproponować coś bardziej dopracowanego lub dłuższego, jeśli pasuje (np. weekend, batch cooking) — ale unikaj sytuacji, gdzie cały tydzień to fancy restauracyjne dania.
- Unikaj wymyślnych technik (sous-vide, confit, pianki, redukcje) i trudno dostępnych składników (trufle, foie gras).

RÓŻNORODNOŚĆ KUCHNI (WAŻNE):
- Użytkownik LUBI NOWOŚCI i dania z różnych kuchni świata. Nie ograniczaj się do polskich dań domowych.
- Aktywnie mieszaj kuchnie: włoska (pasta, risotto, pizza, panini), azjatycka (stir-fry, ramen, pad thai, curry tajskie, sushi bowls, bibimbap, gyoza), meksykańska (tacos, quesadilla, burrito bowl, fajitas), bliskowschodnia (hummus, shakshuka, falafel, kofta), indyjska (curry, dal, biryani, masala), grecka (gyros, sałatka grecka, mussaka), amerykańska (burger, mac&cheese, BBQ), francuska (omlet, quiche, croque-monsieur), polska (pierogi, schabowy, gołąbki) — i inne.
- Tytuły, opisy, kategorie ZAWSZE po polsku, ale samo danie może być z dowolnej kuchni (np. "Kurczak teriyaki z ryżem", "Tacos z wołowiną", "Shakshuka z fetą", "Pad thai z krewetkami").
- Zaskakuj — nie powtarzaj tych samych typów dań w tygodniu.

BATCH COOKING / RESZTKI (WAŻNE):
- Dla obiadu i kolacji DODAJ w tygodniu 1-2 propozycje "batch cooking" — większe dania, które naturalnie starczą na 2 porcje i smakują odgrzane.
- Przykłady: gulasz, bigos, lasagne, zapiekanka makaronowa, zupa pomidorowa, zupa gulaszowa, rosół, pieczeń, curry z kurczakiem, chili con carne, leczo, spaghetti bolognese.
- Gdy proponujesz takie danie w dniu N, DODAJ TĘ SAMĄ opcję w dniu N+1 w tym samym slocie (obiad lub kolacja) — oznacz polem "leftover_from_day": N i poprzedź tytuł "♻️ ", a w description dodaj krótką notkę "Z wczorajszego obiadu — odgrzej i podawaj." (lub odpowiednio "z wczorajszej kolacji").
- Opcja resztek może być "source": "new" z tym samym tytułem (bez ♻️) jako "leftover_title", ALBO "source": "existing" z tym samym recipe_id. W obu przypadkach ustaw "leftover_from_day".
- Bez przesady: maksymalnie 2 pary resztek na tydzień. Pozostałe 2-3 opcje w slocie nadal świeże, żeby użytkownik miał wybór.
- Nigdy nie dawaj resztek w śniadaniu ani deserze.
${preferences ? `- Preferencje użytkownika: ${preferences}` : ''}
- Zwróć WYŁĄCZNIE poprawny JSON, bez markdown.

Struktura JSON:
{
  "plan": [
    {
      "day": 1,
      "meals": {
        "breakfast": {
          "options": [
            { "source": "existing", "recipe_id": "uuid", "title": "nazwa" },
            { "source": "new", "title": "Jajecznica ze szczypiorkiem", "description": "Klasyczna jajecznica na maśle.", "category": "Śniadanie", "prep_time_minutes": 5, "cook_time_minutes": 5 }
          ]
        },
        "lunch": { "options": [
          { "source": "new", "title": "Gulasz wołowy z papryką", "description": "Duża porcja na 2 dni.", "category": "Obiad", "prep_time_minutes": 15, "cook_time_minutes": 90, "batch_cooking": true }
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
          { role: 'user', content: singleSlot ? 'Wygeneruj teraz 4 świeże, proste propozycje na ten slot.' : 'Wygeneruj teraz plan posiłków z wieloma prostymi opcjami na każdy posiłek.' },
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

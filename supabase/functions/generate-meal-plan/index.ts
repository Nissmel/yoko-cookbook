import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// How many scraped recipes to send to the model as inspiration / candidates.
// Tuned to keep the prompt under ~30k tokens while giving meaningful variety.
const SCRAPED_SAMPLE_SIZE = 150;

interface ScrapedSample {
  id: string;
  title: string;
  source_url: string;
  source_name?: string;
}

/**
 * Pull a sample of scraped recipes across active sources, weighted by the
 * caller's `sourceWeights` map ({ source_id: weight 0-5 }). Sources with
 * weight 0 are excluded entirely; higher weights dominate the sample.
 */
async function fetchScrapedSample(
  sourceWeights?: Record<string, number>,
): Promise<ScrapedSample[]> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return [];

    const supabase = createClient(supabaseUrl, serviceKey);
    // Over-fetch so weighted sampling has room to work.
    const { data, error } = await supabase
      .from('scraped_recipes')
      .select('id, title, source_url, source_id, recipe_sources(name)')
      .limit(SCRAPED_SAMPLE_SIZE * 6);

    if (error || !data) return [];

    const filtered = (data as any[]).filter((r) => {
      if (!sourceWeights) return true;
      const w = sourceWeights[r.source_id];
      // If the user provided weights, an unknown source defaults to 1.
      // A weight of 0 means "exclude this source".
      return w === undefined ? true : w > 0;
    });

    // Weighted reservoir-style sampling: key = -log(U) / weight, take smallest keys.
    const keyed = filtered.map((r) => {
      const w = sourceWeights?.[r.source_id];
      const weight = (w === undefined ? 1 : w) || 0.0001;
      const u = Math.random();
      return { r, key: -Math.log(u || 1e-9) / weight };
    });
    keyed.sort((a, b) => a.key - b.key);
    const picked = keyed.slice(0, SCRAPED_SAMPLE_SIZE).map((x) => x.r);

    return picked.map((r: any) => ({
      id: r.id,
      title: r.title,
      source_url: r.source_url,
      source_name: r.recipe_sources?.name,
    }));
  } catch (err) {
    console.error('fetchScrapedSample failed:', err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      recipes,
      days,
      preferences,
      singleSlot,
      singleDay,
      exclude,
      excludeByMeal,
      sourceWeights,
      ownWeight,
      newWeight,
    } = await req.json();
    if (!days && !singleSlot && !singleDay) {
      return new Response(JSON.stringify({ error: 'Days, singleSlot or singleDay required' }), {
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

    // Pull scraped recipe candidates, weighted per source.
    const scrapedCandidates = await fetchScrapedSample(sourceWeights);

    const mealLabelMap: Record<string, string> = {
      breakfast: 'Śniadanie',
      lunch: 'Obiad',
      dinner: 'Kolacja',
      dessert: 'Deser',
    };

    // Compute target proportions from caller weights.
    // Default ratio is 1 / 2 / 1 (existing / scraped / new) per slot of 4 options.
    const wOwn = Math.max(0, ownWeight ?? 1);
    const wNew = Math.max(0, newWeight ?? 1);
    // Aggregate scraped weight = sum of per-source weights (capped to keep ratio sane).
    const wScrapedRaw = sourceWeights
      ? Object.values(sourceWeights).reduce((a: number, b) => a + Math.max(0, Number(b) || 0), 0)
      : 2;
    const wScraped = Math.max(0, wScrapedRaw);

    const totalW = wOwn + wScraped + wNew || 1;
    const slot = 4;
    let nOwn = Math.round((wOwn / totalW) * slot);
    let nNew = Math.round((wNew / totalW) * slot);
    let nScraped = slot - nOwn - nNew;
    if (nScraped < 0) {
      nScraped = 0;
      const over = nOwn + nNew - slot;
      if (nNew >= over) nNew -= over;
      else { nOwn -= over - nNew; nNew = 0; }
    }
    // Force at least 1 "new" if AI has nothing else.
    if (nOwn + nScraped + nNew === 0) nNew = slot;

    const sourceTypesBlock = `
TRZY TYPY PROPOZYCJI (BARDZO WAŻNE — zawsze ustaw "source"):
1. "existing" — przepis już zapisany w książce kucharskiej użytkownika. DOŁĄCZ "recipe_id" z listy poniżej.
2. "scraped" — gotowy przepis z biblioteki polskich blogów kulinarnych (lista poniżej). DOŁĄCZ "scraped_id" z listy. Tytuł skopiuj 1:1.
3. "new" — całkowicie nowy pomysł, którego nie ma ani w książce, ani w bibliotece. AI musi go wygenerować od zera.

PROPORCJE (CEL DLA KAŻDEGO SLOTU — 4 opcje, dostosowane do preferencji użytkownika):
- ${nOwn} opcji "existing" (z książki użytkownika),
- ${nScraped} opcji "scraped" (z biblioteki polskich blogów),
- ${nNew} opcji "new" (świeży pomysł AI).
Jeśli istniejących nie ma lub żaden nie pasuje → zastąp dodatkową opcją "scraped" lub "new". Jeśli scraped nie pasuje tematycznie → zastąp przez "new".
NIGDY nie wymyślaj scraped_id ani recipe_id — używaj tylko tych z list poniżej. Jeśli żaden nie pasuje, użyj "source": "new".
`;

    const ownRecipesBlock = existingRecipes.length > 0
      ? `KSIĄŻKA KUCHARSKA UŻYTKOWNIKA (source: "existing"):\n${JSON.stringify(existingRecipes, null, 2)}\n`
      : 'Użytkownik nie ma jeszcze własnych przepisów.\n';

    const scrapedBlock = scrapedCandidates.length > 0
      ? `BIBLIOTEKA SCRAPED (source: "scraped" — wybieraj te które tematycznie pasują do danego slotu, np. "Szakszuka" do śniadania, "Gulasz" do obiadu, "Sałatka" do kolacji, "Sernik" do deseru):\n${JSON.stringify(scrapedCandidates.map(s => ({ scraped_id: s.id, title: s.title, source: s.source_name })), null, 2)}\n`
      : 'Brak biblioteki scraped.\n';

    const systemPrompt = singleDay
      ? `Jesteś kreatywnym asystentem planowania posiłków. Wygeneruj ŚWIEŻE propozycje dla CAŁEGO JEDNEGO DNIA (4 sloty: śniadanie, obiad, kolacja, deser).

${ownRecipesBlock}
${scrapedBlock}
${sourceTypesBlock}

Dzień: ${singleDay.day}
${excludeByMeal ? `UNIKAJ tych tytułów dla danych slotów (już pokazane, użytkownikowi się nie spodobały):\n${Object.entries(excludeByMeal).map(([m, titles]: any) => `${mealLabelMap[m] || m}: ${(titles as string[]).join(', ')}`).join('\n')}\n` : ''}

Zasady:
- Podaj dokładnie 4 NOWE propozycje dla KAŻDEGO z 4 slotów: breakfast, lunch, dinner, dessert.
- Każda opcja MUSI mieć "source" ustawiony na "existing", "scraped" lub "new".
- Dla "new" dołącz: title, krótki description (1 zdanie), category (Śniadanie/Obiad/Kolacja/Zupa/Sałatka/Deser/Przekąska/Przystawka), prep_time_minutes, cook_time_minutes.
- Dla "scraped" wystarczy: source, scraped_id, title (skopiowany z listy).
- Tytuły konkretne i apetyczne, PO POLSKU.
- CHARAKTER: Śniadanie = lekkie i szybkie. Obiad = główne ciepłe danie dnia. Kolacja = LEKKA, 10-25 min (sałatki, kanapki, omlety, lekkie zupy) — UNIKAJ kotletów, pieczeni, ciężkich mięsnych dań na kolację. Deser = słodkie.
- WSKAZÓWKA dot. prostoty: większość propozycji codzienna i prosta.
- RÓŻNORODNOŚĆ KUCHNI: aktywnie mieszaj kuchnie świata. Tytuły zawsze po polsku.
- Bądź KREATYWNY i RÓŻNY od wykluczonych tytułów.
- BATCH COOKING dla obiadu: warto zaproponować 1-2 opcje obiadu z polem "batch_cooking": true.
${preferences ? `- Preferencje użytkownika: ${preferences}` : ''}
- Zwróć WYŁĄCZNIE poprawny JSON, bez markdown.

Struktura JSON:
{
  "meals": {
    "breakfast": { "options": [
      { "source": "existing", "recipe_id": "uuid", "title": "..." },
      { "source": "scraped", "scraped_id": "uuid", "title": "..." },
      { "source": "new", "title": "...", "description": "...", "category": "...", "prep_time_minutes": 5, "cook_time_minutes": 5 }
    ] },
    "lunch": { "options": [...] },
    "dinner": { "options": [...] },
    "dessert": { "options": [...] }
  }
}`
      : singleSlot
      ? `Jesteś kreatywnym asystentem planowania posiłków. Wygeneruj ŚWIEŻE propozycje dla JEDNEGO slotu posiłkowego.

${ownRecipesBlock}
${scrapedBlock}
${sourceTypesBlock}

Slot: ${mealLabelMap[singleSlot.mealType] || singleSlot.mealType} (dzień ${singleSlot.day})
${exclude?.length ? `UNIKAJ tych tytułów (już pokazane, użytkownikowi się nie spodobały):\n${exclude.map((t: string) => `- ${t}`).join('\n')}\n` : ''}

Zasady:
- Podaj dokładnie 4 NOWE propozycje dla tego slotu.
- Każda opcja MUSI mieć "source" ustawiony na "existing", "scraped" lub "new".
- Dla "new" dołącz: title, krótki description (1 zdanie), category (Śniadanie/Obiad/Kolacja/Zupa/Sałatka/Deser/Przekąska/Przystawka), prep_time_minutes, cook_time_minutes.
- Dla "scraped": source, scraped_id, title (z listy).
- Tytuły konkretne i apetyczne, PO POLSKU.
- CHARAKTER SLOTU: ${singleSlot.mealType === 'breakfast' ? 'Śniadanie — lekkie i szybkie (jajka, owsianka, kanapki, naleśniki, omlet, jogurt z owocami, shakshuka).' : singleSlot.mealType === 'lunch' ? 'Obiad — GŁÓWNE ciepłe danie dnia: mięso/ryba/strączki + skrobia + warzywa, makarony, curry, gulasze, zupy obiadowe.' : singleSlot.mealType === 'dinner' ? 'Kolacja — LEKKA, prosta, sycąca ale NIE objadowa, 10-25 min: sałatki, kanapki/tosty, wraps, omlety, lekkie zupy kremy, miski, placuszki, quiche, frittata. UNIKAJ kotletów, pieczeni, gulaszy, ciężkich mięs.' : 'Deser — ciasta, mus, lody, tarty, fit desery.'}
- WSKAZÓWKA dot. prostoty: większość propozycji codzienna i prosta.
- RÓŻNORODNOŚĆ KUCHNI: użytkownik lubi nowości i dania z różnych kuchni świata.
- Bądź KREATYWNY i RÓŻNY od wykluczonych tytułów.
${preferences ? `- Preferencje użytkownika: ${preferences}` : ''}
- Zwróć WYŁĄCZNIE poprawny JSON, bez markdown.

Struktura JSON:
{
  "options": [
    { "source": "existing", "recipe_id": "uuid", "title": "nazwa" },
    { "source": "scraped", "scraped_id": "uuid", "title": "nazwa z biblioteki" },
    { "source": "new", "title": "...", "description": "...", "category": "...", "prep_time_minutes": 10, "cook_time_minutes": 15 }
  ]
}`
      : `Jesteś kreatywnym asystentem planowania posiłków. Wygeneruj plan posiłków z WIELOMA OPCJAMI na każdy slot, żeby użytkownik mógł wybrać.

${ownRecipesBlock}
${scrapedBlock}
${sourceTypesBlock}

Zasady:
- Plan na ${days} dni.
- Każdy dzień ma 4 typy posiłków: breakfast (Śniadanie), lunch (Obiad), dinner (Kolacja), dessert (Deser).
- Dla KAŻDEGO slotu podaj dokładnie 4 opcje.
- Każda opcja MUSI mieć "source" ustawiony na "existing" / "scraped" / "new".
- Postaraj się mieszać: 1-2 existing (jeśli są), 1-2 scraped (jeśli pasują), reszta new.
- Dla "new" dołącz: title, krótki description (1 zdanie), category, prep_time_minutes, cook_time_minutes.
- Dla "scraped": source, scraped_id, title (z listy).
- WSZYSTKO PO POLSKU — tytuły, opisy, kategorie. Bez angielskich słów.
- Tytuły konkretne i apetyczne.

CHARAKTER POSIŁKÓW (BARDZO WAŻNE — nie myl obiadu z kolacją):
- Śniadanie: lekkie, szybkie — owsianka, jajka, kanapki, naleśniki, jogurt z owocami, omlet, shakshuka, tosty francuskie.
- Obiad: GŁÓWNE, najedzeniowe, ciepłe danie dnia — mięso/ryba/strączki + skrobia + warzywa, zupy obiadowe, makarony, curry, gulasze, pieczenie, dania jednogarnkowe.
- Kolacja: LEKKA, prosta, sycąca ale NIE objadowa. Szybka (10-25 min). Sałatki, kanapki/tosty, wraps, omlety, twarożki, lekkie zupy, poke bowl, placuszki warzywne, quiche, frittata. UNIKAJ NA KOLACJĘ: kotletów schabowych, pieczeni, gulaszy, ciężkich mięs, BBQ, smażonych panierowanych mięs.
- Deser: ciasta, mus, lody, tarty, fit desery.

WSKAZÓWKI dot. prostoty:
- Większość propozycji niech będzie codzienna i prosta — śniadania i kolacje 10-25 min, obiady 20-40 min.
- Możesz CZASEM (1-2 razy w tygodniu) zaproponować coś bardziej dopracowanego NA OBIAD.
- Unikaj wymyślnych technik (sous-vide, confit) i trudno dostępnych składników (trufle).

RÓŻNORODNOŚĆ KUCHNI:
- Użytkownik LUBI NOWOŚCI i dania z różnych kuchni świata.
- Aktywnie mieszaj kuchnie: włoska, azjatycka, meksykańska, bliskowschodnia, indyjska, grecka, amerykańska, francuska, polska — i inne.

BATCH COOKING / RESZTKI (BARDZO WAŻNE):
- DOMYŚLNIE staraj się, żeby OBIADY były dwudniowe. Cel: 2-3 PARY obiadów (dzień N + dzień N+1) z większej porcji.
- Tylko slot OBIAD.
- W slocie obiadowym dnia N OZNACZ minimum jedną opcję jako "batch_cooking": true. Przykłady: gulasz, lasagne, curry, chili, leczo, spaghetti bolognese.
- W slocie obiadowym dnia N+1 DODAJ TĘ SAMĄ opcję — oznacz "leftover_from_day": N i poprzedź tytuł "♻️ ".
- Pozostałe 2-3 opcje w slocie obiadowym nadal świeże.
- NIGDY nie dawaj resztek w śniadaniu, kolacji ani deserze.
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
            { "source": "scraped", "scraped_id": "uuid", "title": "Szakszuka z fetą" },
            { "source": "new", "title": "Jajecznica ze szczypiorkiem", "description": "...", "category": "Śniadanie", "prep_time_minutes": 5, "cook_time_minutes": 5 }
          ]
        },
        "lunch": { "options": [
          { "source": "scraped", "scraped_id": "uuid", "title": "Gulasz wołowy z papryką", "batch_cooking": true }
        ] },
        "dinner": { "options": [...] },
        "dessert": { "options": [...] }
      }
    },
    {
      "day": 2,
      "meals": {
        "lunch": { "options": [
          { "source": "scraped", "scraped_id": "uuid", "title": "♻️ Gulasz wołowy z papryką", "leftover_from_day": 1 }
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
          { role: 'user', content: singleDay
            ? `Wygeneruj teraz 4 świeże propozycje dla każdego z 4 slotów na dzień ${singleDay.day}.`
            : singleSlot
            ? 'Wygeneruj teraz 4 świeże, proste propozycje na ten slot.'
            : 'Wygeneruj teraz plan posiłków z wieloma prostymi opcjami na każdy posiłek.' },
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

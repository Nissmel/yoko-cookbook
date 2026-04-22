import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingListItem } from '@/types/recipe';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// ---- Normalization helpers ---------------------------------------------------

// Normalize PL diacritics + lowercase + strip plural suffixes for fuzzy comparison.
function normalize(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[ąà]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęè]/g, 'e')
    .replace(/[łl]/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óò]/g, 'o')
    .replace(/[śš]/g, 's').replace(/[źżž]/g, 'z')
    .replace(/\s+/g, ' ');
}

// Common Polish descriptive adjectives that should NOT prevent merging.
// "świeży szczypiorek" ≡ "szczypiorek", "drobno posiekana cebula" ≡ "cebula", etc.
const STOPWORDS = new Set([
  // freshness / state
  'swiezy', 'swieza', 'swieze', 'swiezo',
  'suszony', 'suszona', 'suszone',
  'mrozony', 'mrozona', 'mrozone', 'mrozonego',
  'surowy', 'surowa', 'surowe',
  'gotowany', 'gotowana', 'gotowane',
  'pieczony', 'pieczona', 'pieczone',
  'wedzony', 'wedzona', 'wedzone',
  'marynowany', 'marynowana', 'marynowane',
  'kiszony', 'kiszona', 'kiszone',
  // size / cut
  'duzy', 'duza', 'duze', 'maly', 'mala', 'male', 'sredni', 'srednia', 'srednie',
  'drobno', 'grubo', 'cienko', 'mielony', 'mielona', 'mielone',
  'posiekany', 'posiekana', 'posiekane',
  'pokrojony', 'pokrojona', 'pokrojone',
  'starty', 'starta', 'starte',
  'obrany', 'obrana', 'obrane',
  // color
  'czerwony', 'czerwona', 'czerwone',
  'zielony', 'zielona', 'zielone',
  'zolty', 'zolta', 'zolte',
  'bialy', 'biala', 'biale',
  'czarny', 'czarna', 'czarne',
  // generic
  'naturalny', 'naturalna', 'naturalne',
  'dojrzaly', 'dojrzala', 'dojrzale',
  'caly', 'cala', 'cale',
  'ekologiczny', 'ekologiczna', 'ekologiczne',
  'bio',
  // fillers
  'do', 'na', 'z', 'ze', 'w', 'i',
]);

// Strip stopwords / adjectives so descriptive variants merge.
function canonicalName(name: string): string {
  const words = normalize(name)
    .replace(/[(),.;:]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  return words.join(' ').trim();
}

// Canonicalize a unit so "g" and "gram" (etc.) merge.
function normalizeUnit(unit?: string | null): string {
  if (!unit) return '';
  const u = unit.toLowerCase().trim().replace(/\.$/, '');
  const map: Record<string, string> = {
    gram: 'g', grams: 'g', gramy: 'g', gramow: 'g', 'gramów': 'g',
    kilogram: 'kg', kg: 'kg', kilo: 'kg',
    ml: 'ml', milliliter: 'ml',
    l: 'l', liter: 'l', litr: 'l', litry: 'l',
    szt: 'szt', sztuka: 'szt', sztuki: 'szt', sztuk: 'szt', pcs: 'szt', piece: 'szt', pieces: 'szt',
    'łyżka': 'łyżka', 'łyżki': 'łyżka', 'łyżek': 'łyżka', tbsp: 'łyżka',
    'łyżeczka': 'łyżeczka', 'łyżeczki': 'łyżeczka', 'łyżeczek': 'łyżeczka', tsp: 'łyżeczka',
    'szklanka': 'szklanka', 'szklanki': 'szklanka', cup: 'szklanka',
    'ząbek': 'ząbek', 'ząbki': 'ząbek', 'ząbków': 'ząbek', clove: 'ząbek',
  };
  return map[u] ?? u;
}

// Parse a quantity like "2", "2.5", "1/2", "1 1/2", "2-3" → number (avg for ranges).
function parseQty(q?: string | null): number | null {
  if (q == null) return null;
  const s = String(q).trim().replace(',', '.');
  if (!s) return null;
  // Range "2-3" or "2–3"
  const range = s.match(/^([\d./\s]+)\s*[-–]\s*([\d./\s]+)$/);
  if (range) {
    const a = parseQty(range[1]);
    const b = parseQty(range[2]);
    if (a != null && b != null) return (a + b) / 2;
  }
  // Mixed "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  // Fraction "1/2"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  // Plain number
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '';
  // Strip trailing zeros, max 2 decimals
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function ingredientKey(name: string): string {
  // Use canonical form so "świeży szczypiorek" === "szczypiorek".
  // Fall back to plain normalized name if canonicalization strips everything.
  const canon = canonicalName(name);
  return canon || normalize(name);
}

// True if a pantry name matches an ingredient name (fuzzy match on canonicalized text).
function pantryMatchesIngredient(pantryName: string, ingredientName: string): boolean {
  const ing = ingredientKey(ingredientName);
  const pn = ingredientKey(pantryName);
  if (!ing || !pn) return false;
  return ing === pn || ing.includes(pn) || pn.includes(ing);
}

export interface NewShoppingItem {
  ingredient_name: string;
  quantity?: string | null;
  unit?: string | null;
  recipe_id?: string | null;
}

// ---- Queries ----------------------------------------------------------------

export function useShoppingList(ownerId?: string) {
  const { user } = useAuth();
  // When ownerId is provided we're viewing someone else's (shared) list.
  const targetId = ownerId ?? user?.id;

  return useQuery({
    queryKey: ['shopping-list', targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('user_id', targetId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ShoppingListItem[];
    },
    enabled: !!targetId,
  });
}

// ---- Smart add: merge duplicates + pantry-aware subtraction ----------------

// Optional `ownerId` — when provided, items are added to that owner's list/pantry
// (used when a shared user adds ingredients from a recipe owned by someone else).
export function useAddToShoppingList(ownerId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (items: NewShoppingItem[]) => {
      if (!user || items.length === 0) return { inserted: 0, merged: 0, skipped: 0 };
      const targetUserId = ownerId ?? user.id;

      // Fetch target owner's pantry & current shopping list (unchecked only — checked
      // items are "history" and shouldn't be merged into).
      const [{ data: pantry }, { data: existingList }] = await Promise.all([
        supabase.from('pantry_items').select('name, quantity, unit').eq('user_id', targetUserId),
        supabase
          .from('shopping_list_items')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('checked', false),
      ]);

      const pantryItems = pantry ?? [];
      const existing = (existingList ?? []) as ShoppingListItem[];

      // Step 1: merge incoming duplicates among themselves
      // Key = normalized name + normalized unit
      type Bucket = { name: string; unit: string; qty: number | null; rawUnit: string | null; recipeId: string | null; hasUnparseable: boolean; rawQtyParts: string[] };
      const buckets = new Map<string, Bucket>();

      for (const i of items) {
        const nameKey = ingredientKey(i.ingredient_name);
        const unitKey = normalizeUnit(i.unit);
        const key = `${nameKey}::${unitKey}`;
        const parsed = parseQty(i.quantity);

        const b = buckets.get(key);
        if (b) {
          if (parsed != null && !b.hasUnparseable) {
            b.qty = (b.qty ?? 0) + parsed;
          } else {
            b.hasUnparseable = true;
            if (i.quantity) b.rawQtyParts.push(String(i.quantity));
          }
        } else {
          buckets.set(key, {
            name: i.ingredient_name,
            unit: unitKey,
            qty: parsed,
            rawUnit: i.unit ?? null,
            recipeId: i.recipe_id ?? null,
            hasUnparseable: parsed == null && i.quantity != null,
            rawQtyParts: parsed == null && i.quantity ? [String(i.quantity)] : [],
          });
        }
      }

      // Step 2: subtract pantry from each bucket's total demand
      for (const b of buckets.values()) {
        const matching = pantryItems.filter((p) => pantryMatchesIngredient(p.name, b.name));
        if (!matching.length) continue;

        // If both sides parse cleanly with same unit → numeric subtract.
        // Otherwise fallback: if pantry has ANY of it, mark to skip when no qty.
        const sameUnitPantryQty = matching.reduce((sum, p) => {
          if (normalizeUnit(p.unit) === b.unit) {
            const pq = parseQty(p.quantity);
            return pq != null ? sum + pq : sum;
          }
          return sum;
        }, 0);

        if (b.qty != null && sameUnitPantryQty > 0) {
          b.qty = Math.max(0, b.qty - sameUnitPantryQty);
        } else if (b.qty == null && !b.hasUnparseable) {
          // No qty info on either side, but it's in pantry — skip.
          b.qty = 0;
        }
      }

      // Step 3: split into to-update (matches existing list row) vs to-insert,
      //   and drop anything that ended up at 0 demand.
      const toInsert: any[] = [];
      const toUpdate: { id: string; quantity: string | null }[] = [];
      let merged = 0;
      let skipped = 0;

      for (const b of buckets.values()) {
        if (b.qty != null && b.qty <= 0 && !b.hasUnparseable) {
          skipped++;
          continue;
        }

        const existingMatch = existing.find(
          (e) => ingredientKey(e.ingredient_name) === ingredientKey(b.name)
            && normalizeUnit(e.unit) === b.unit,
        );

        // Build the final quantity string
        let qtyStr: string | null;
        if (b.hasUnparseable) {
          // Keep raw text concatenated
          qtyStr = b.rawQtyParts.join(' + ') || null;
        } else if (b.qty != null) {
          qtyStr = formatQty(b.qty);
        } else {
          qtyStr = null;
        }

        if (existingMatch) {
          // Sum with existing row qty when possible
          const existingQty = parseQty(existingMatch.quantity);
          let nextQtyStr = qtyStr;
          if (existingQty != null && b.qty != null && !b.hasUnparseable) {
            nextQtyStr = formatQty(existingQty + b.qty);
          } else if (existingMatch.quantity && qtyStr) {
            nextQtyStr = `${existingMatch.quantity} + ${qtyStr}`;
          } else if (existingMatch.quantity && !qtyStr) {
            nextQtyStr = existingMatch.quantity;
          }
          toUpdate.push({ id: existingMatch.id, quantity: nextQtyStr });
          merged++;
        } else {
          toInsert.push({
            user_id: targetUserId,
            ingredient_name: b.name,
            quantity: qtyStr,
            unit: b.rawUnit,
            recipe_id: b.recipeId,
          });
        }
      }

      // Step 4: execute
      if (toInsert.length > 0) {
        const { error } = await supabase.from('shopping_list_items').insert(toInsert);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { error } = await supabase
          .from('shopping_list_items')
          .update({ quantity: u.quantity })
          .eq('id', u.id);
        if (error) throw error;
      }

      return { inserted: toInsert.length, merged, skipped };
    },
    onSuccess: ({ inserted, merged, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      const parts: string[] = [];
      if (inserted > 0) parts.push(`Dodano ${inserted}`);
      if (merged > 0) parts.push(`scalono ${merged}`);
      if (parts.length === 0 && skipped > 0) {
        toast.info('Wszystko już masz w spiżarni 🎉');
      } else if (parts.length > 0) {
        toast.success(parts.join(', '), {
          description: skipped > 0 ? `Pominięto ${skipped} (są w spiżarni)` : undefined,
        });
      }
    },
  });
}

// ---- Mutations on existing items -------------------------------------------

export function useToggleShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ checked })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

// Clear-checked / clear-all accept an optional ownerId so the action targets the
// list currently being viewed (own list or a shared owner's list).
export function useClearCheckedItems() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ownerId?: string) => {
      const targetId = ownerId ?? user!.id;
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('user_id', targetId)
        .eq('checked', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

export function useClearAllItems() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ownerId?: string) => {
      const targetId = ownerId ?? user!.id;
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('user_id', targetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });
}

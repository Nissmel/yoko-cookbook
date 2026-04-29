// Recipe scaling helpers.
// Handles: integers, decimals (1.5 / 1,5), unicode fractions (½),
// ascii fractions ("1/2", "1 1/2"), ranges ("2-3"), and units inside the
// quantity string ("500 g", "2 łyżki").
// Also rewrites instruction text by replacing the original ingredient
// quantities with their scaled values, instead of prefixing the name.

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3,
  '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

// Parse a single numeric token (no ranges) into a number.
// Supports "1", "1.5", "1,5", "1/2", "1 1/2", "½", "1½".
function parseSingleNumber(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;

  // Pure unicode fraction or mixed "1½"
  const uniMatch = s.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (uniMatch) {
    const whole = uniMatch[1] ? parseInt(uniMatch[1], 10) : 0;
    return whole + UNICODE_FRACTIONS[uniMatch[2]];
  }

  // Mixed ascii fraction "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  }

  // Plain ascii fraction "1/2"
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const denom = parseInt(frac[2], 10);
    if (denom === 0) return null;
    return parseInt(frac[1], 10) / denom;
  }

  // Decimal/integer
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

// Format a scaled number nicely. Prefers common fractions for small values.
function formatNumber(n: number): string {
  if (!isFinite(n)) return '';
  if (n === 0) return '0';

  // Try to round to a common fraction (eighths) when value < 10
  if (n < 10) {
    const eighths = Math.round(n * 8) / 8;
    if (Math.abs(eighths - n) < 0.02) {
      const whole = Math.floor(eighths);
      const rest = eighths - whole;
      const fracMap: Record<string, string> = {
        '0.125': '⅛', '0.25': '¼', '0.375': '⅜',
        '0.5': '½', '0.625': '⅝', '0.75': '¾', '0.875': '⅞',
      };
      const key = rest.toString();
      if (rest === 0) return whole.toString();
      if (fracMap[key]) return whole > 0 ? `${whole}${fracMap[key]}` : fracMap[key];
    }
  }

  // Larger values: round sensibly
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) {
    const r = Math.round(n * 2) / 2; // nearest 0.5
    return r % 1 === 0 ? r.toString() : r.toFixed(1);
  }
  // Fallback decimal with up to 2 dp
  const r = Math.round(n * 100) / 100;
  return r.toString();
}

/**
 * Scale a quantity string by a factor.
 * Returns the original string unchanged if no number can be parsed
 * (e.g. "szczypta", "do smaku").
 */
export function scaleQuantity(qty: string | undefined | null, scale: number): string {
  if (!qty) return '';
  if (scale === 1) return qty;

  // Range "2-3" or "2 - 3"
  const range = qty.match(/^\s*([\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+?)\s*[-–]\s*([\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+?)(\s.*)?$/);
  if (range) {
    const a = parseSingleNumber(range[1]);
    const b = parseSingleNumber(range[2]);
    const tail = range[3] || '';
    if (a !== null && b !== null) {
      return `${formatNumber(a * scale)}-${formatNumber(b * scale)}${tail}`;
    }
  }

  // Single number, optionally followed by unit text ("500 g", "2 łyżki")
  const single = qty.match(/^\s*([\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+?)(\s+\S.*)?$/);
  if (single) {
    const n = parseSingleNumber(single[1]);
    if (n !== null) {
      const tail = single[2] || '';
      return `${formatNumber(n * scale)}${tail}`;
    }
  }

  return qty; // unparseable — leave alone
}

/**
 * Legacy fallback: rewrite an instruction step by replacing original
 * ingredient quantities with their scaled values. Used only for recipes
 * that don't yet have [[...]] markup.
 */
export function scaleInstructionText(
  step: string,
  ingredients: { name?: string; unit?: string; quantity?: string }[],
  scale: number,
): string {
  if (scale === 1 || !step) return step;

  let result = step;

  for (const ing of ingredients) {
    const origQty = ing.quantity?.trim();
    if (!origQty) continue;
    const n = parseSingleNumber(origQty);
    if (n === null || n === 0) continue;
    const scaled = formatNumber(n * scale);
    const unit = (ing.unit || '').trim();

    if (unit) {
      const unitEsc = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        `(\\b|^)${escapeNumber(origQty)}\\s*${unitEsc}\\b`,
        'i',
      );
      if (re.test(result)) {
        result = result.replace(re, `$1${scaled} ${unit}`);
        continue;
      }
    }

    if (ing.name) {
      const nameEsc = ing.name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re2 = new RegExp(
        `(\\b|^)${escapeNumber(origQty)}\\s+(${nameEsc})`,
        'i',
      );
      if (re2.test(result)) {
        result = result.replace(re2, `$1${scaled} $2`);
      }
    }
  }

  return result;
}

function escapeNumber(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===========================================================================
// [[...]] markup parser & renderer
// ===========================================================================
//
// Recipes can mark inline ingredient mentions in instructions using
// double square brackets, e.g.:
//     "Mix [[400 g flour]] with [[7 g yeast]] until smooth."
//
// The first numeric token inside the brackets is treated as a scalable
// quantity. Brackets without any number (e.g. "[[salt to taste]]") are
// rendered with the same emphasis but their text is left unchanged.
//
// We intentionally do NOT try to guess unmarked ingredients — that's the
// whole point of the markup: only what the author marked gets scaled.

export type InstructionToken =
  | { type: 'text'; value: string }
  | { type: 'ingredient'; original: string; scaled: string };

const MARKUP_RE = /\[\[([^\][]+)\]\]/g;

/**
 * Tokenize an instruction step that may contain [[...]] markup.
 * Returns an array of plain-text and ingredient tokens.
 *
 * If the step contains no markup at all and `ingredients` are provided,
 * we fall back to the legacy `scaleInstructionText` helper so old recipes
 * still scale (best-effort) until they're backfilled.
 */
export function tokenizeInstruction(
  step: string,
  scale: number,
  ingredients?: { name?: string; unit?: string; quantity?: string }[],
): InstructionToken[] {
  if (!step) return [];

  // No markup → legacy best-effort path
  if (!step.includes('[[')) {
    const legacy = ingredients
      ? scaleInstructionText(step, ingredients, scale)
      : step;
    return [{ type: 'text', value: legacy }];
  }

  const tokens: InstructionToken[] = [];
  let lastIndex = 0;
  // Reset regex state
  MARKUP_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKUP_RE.exec(step)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: step.slice(lastIndex, match.index) });
    }
    const inner = match[1].trim();
    tokens.push({
      type: 'ingredient',
      original: inner,
      scaled: scaleMarkupInner(inner, scale),
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < step.length) {
    tokens.push({ type: 'text', value: step.slice(lastIndex) });
  }
  return tokens;
}

/**
 * Scale the first numeric token inside a [[...]] marker.
 * Examples:
 *   "400 g mąki"   ×2 → "800 g mąki"
 *   "1/2 szklanki mleka" ×2 → "1 szklanki mleka"
 *   "2-3 łyżki cukru" ×2 → "4-6 łyżki cukru"
 *   "sól do smaku" ×2 → "sól do smaku"  (no number → unchanged)
 */
function scaleMarkupInner(inner: string, scale: number): string {
  if (scale === 1) return inner;

  // Range "2-3 unit name"
  const range = inner.match(
    /^(\s*)([\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+?)\s*[-–]\s*([\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+?)(\s+\S.*)?$/,
  );
  if (range) {
    const a = parseSingleNumber(range[2]);
    const b = parseSingleNumber(range[3]);
    if (a !== null && b !== null) {
      const tail = range[4] || '';
      return `${range[1]}${formatNumber(a * scale)}-${formatNumber(b * scale)}${tail}`;
    }
  }

  // Single leading number, optionally followed by unit/name text
  const single = inner.match(
    /^(\s*)([\d.,/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\s+\d+\/\d+)?)(\s+\S.*)?$/,
  );
  if (single) {
    const n = parseSingleNumber(single[2]);
    if (n !== null) {
      const tail = single[3] || '';
      return `${single[1]}${formatNumber(n * scale)}${tail}`;
    }
  }

  return inner;
}


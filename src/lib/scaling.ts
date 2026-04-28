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
 * Rewrite an instruction step by replacing original ingredient quantities
 * with their scaled values. We look for "<number> <unit>" patterns where
 * the unit matches an ingredient unit, OR the number stands close to the
 * ingredient name. Falls back to the original step if nothing matches.
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

    // 1) "<num> <unit>" pattern (most reliable)
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

    // 2) "<num> <ingredient name>" — number directly preceding the name
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

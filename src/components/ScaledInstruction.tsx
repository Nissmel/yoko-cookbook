import { tokenizeInstruction } from '@/lib/scaling';

interface Props {
  step: string;
  scale: number;
  ingredients?: { name?: string; unit?: string; quantity?: string }[];
  className?: string;
}

/**
 * Renders an instruction step. Any text wrapped in [[...]] is highlighted
 * (bold + primary color) and its leading numeric value is scaled by `scale`.
 *
 * For backward compatibility, if the step contains no [[...]] markup we
 * fall back to the legacy text-replacement scaling so old recipes still
 * scale (best-effort) until they're backfilled.
 */
export function ScaledInstruction({ step, scale, ingredients, className }: Props) {
  const tokens = tokenizeInstruction(step, scale, ingredients);
  return (
    <span className={className}>
      {tokens.map((t, i) =>
        t.type === 'text' ? (
          <span key={i}>{t.value}</span>
        ) : (
          <strong
            key={i}
            className="font-medium text-foreground/90 whitespace-nowrap"
          >
            {t.scaled}
          </strong>
        ),
      )}
    </span>
  );
}

/**
 * Helper for places that need a plain string (not JSX) — e.g. the timer
 * parser in CookingMode. Strips markup and scales numbers.
 */
export function renderInstructionPlain(
  step: string,
  scale: number,
  ingredients?: { name?: string; unit?: string; quantity?: string }[],
): string {
  return tokenizeInstruction(step, scale, ingredients)
    .map((t) => (t.type === 'text' ? t.value : t.scaled))
    .join('');
}

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecipe } from '@/hooks/useRecipes';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTimers, parseTimeMentions, CookingTimerBar, InlineTimerButton } from '@/components/CookingTimer';
import { tokenizeInstruction } from '@/lib/scaling';

export default function CookingMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading } = useRecipe(id);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const { timers, addTimer, removeTimer, toggleTimer } = useTimers();

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          const lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
        }
      } catch (err) {
        console.log('Wake lock not available');
      }
    };
    requestWakeLock();
    return () => { wakeLock?.release(); };
  }, []);

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recipe) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentStep((s) => Math.min(s + 1, recipe.instructions.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Escape') {
        navigate(-1);
      }
    },
    [recipe, navigate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading || !recipe) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="animate-pulse font-display text-2xl text-primary">Loading...</div>
      </div>
    );
  }

  // Render an instruction step: tokenize [[...]] markup, scale numbers,
  // highlight ingredients, and overlay inline timer buttons on time mentions.
  const renderStepWithTimers = (step: string) => {
    // Cooking mode shows the recipe at its native scale (1x).
    const tokens = tokenizeInstruction(step, 1, recipe.ingredients);

    return (
      <>
        {tokens.map((tok, ti) => {
          if (tok.type === 'ingredient') {
            return (
              <strong key={ti} className="font-semibold text-primary whitespace-nowrap">
                {tok.scaled}
              </strong>
            );
          }
          // Plain text segment — split by time mentions and inject timer buttons
          const text = tok.value;
          const matches = parseTimeMentions(text);
          if (matches.length === 0) return <span key={ti}>{text}</span>;

          let parts: (string | { minutes: number; label: string })[] = [text];
          for (const match of matches) {
            const newParts: (string | { minutes: number; label: string })[] = [];
            for (const part of parts) {
              if (typeof part !== 'string') { newParts.push(part); continue; }
              const idx = part.indexOf(match.label);
              if (idx === -1) { newParts.push(part); continue; }
              if (idx > 0) newParts.push(part.slice(0, idx));
              newParts.push(match);
              if (idx + match.label.length < part.length) newParts.push(part.slice(idx + match.label.length));
            }
            parts = newParts;
          }
          return (
            <span key={ti}>
              {parts.map((part, i) =>
                typeof part === 'string' ? (
                  <span key={i}>{part}</span>
                ) : (
                  <InlineTimerButton key={i} minutes={part.minutes} label={part.label} onStart={addTimer} />
                ),
              )}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <h1 className="font-display text-lg font-bold text-foreground truncate">{recipe.title}</h1>
        <Button variant="ghost" size="icon" onClick={() => { wakeLock?.release(); navigate(-1); }}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Active timers bar */}
      <CookingTimerBar timers={timers} onRemove={removeTimer} onToggle={toggleTimer} />

      <div className="flex-1 overflow-auto flex flex-col md:flex-row">
        {/* Ingredients sidebar */}
        <div className="md:w-80 border-b md:border-b-0 md:border-r border-border p-4 shrink-0 overflow-auto max-h-[30vh] md:max-h-full">
          <h2 className="font-display text-lg font-semibold mb-3">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-center gap-3">
                <Checkbox
                  checked={checkedIngredients.has(i)}
                  onCheckedChange={() => toggleIngredient(i)}
                />
                <span className={`font-body text-base ${checkedIngredients.has(i) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {ing.quantity} {ing.unit} {ing.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Step display */}
        <div className="flex-1 flex flex-col p-6 md:p-12 text-center min-h-0">
          <div className="text-sm text-muted-foreground font-body mb-4 shrink-0">
            Step {currentStep + 1} of {recipe.instructions.length}
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center min-h-0">
            <p className="font-body text-2xl md:text-4xl leading-relaxed max-w-2xl text-foreground">
              {renderStepWithTimers(recipe.instructions[currentStep])}
            </p>
          </div>

          {/* Navigation - always at bottom */}
          <div className="flex items-center justify-center gap-4 mt-6 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentStep((s) => Math.max(s - 1, 0))}
              disabled={currentStep === 0}
              aria-label="Previous step"
              className="h-14 w-14 rounded-full"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              size="icon"
              onClick={() => setCurrentStep((s) => Math.min(s + 1, recipe.instructions.length - 1))}
              disabled={currentStep === recipe.instructions.length - 1}
              aria-label="Next step"
              className="h-14 w-14 rounded-full"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-4 justify-center shrink-0">
            {recipe.instructions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all ${i === currentStep ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

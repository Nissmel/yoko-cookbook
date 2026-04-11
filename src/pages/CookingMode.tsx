import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecipe } from '@/hooks/useRecipes';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTimers, parseTimeMentions, CookingTimerBar, InlineTimerButton } from '@/components/CookingTimer';

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

  const enrichInstruction = (step: string) => {
    let enriched = step;
    recipe.ingredients.forEach((ing) => {
      if (!ing.name) return;
      const namePattern = new RegExp(`\\b${ing.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (namePattern.test(enriched)) {
        const qty = ing.quantity || '';
        const unit = ing.unit || '';
        const prefix = `${qty}${unit ? ' ' + unit : ''}`.trim();
        if (prefix) {
          enriched = enriched.replace(namePattern, `${prefix} ${ing.name}`);
        }
      }
    });
    return enriched;
  };

  // Parse time mentions from current step and render with inline timer buttons
  const renderStepWithTimers = (step: string) => {
    const enriched = enrichInstruction(step);
    const timeMatches = parseTimeMentions(enriched);
    
    if (timeMatches.length === 0) {
      return <span>{enriched}</span>;
    }

    // Replace time mentions with clickable timer buttons
    let parts: (string | { minutes: number; label: string })[] = [enriched];
    
    for (const match of timeMatches) {
      const newParts: (string | { minutes: number; label: string })[] = [];
      for (const part of parts) {
        if (typeof part !== 'string') {
          newParts.push(part);
          continue;
        }
        const idx = part.indexOf(match.label);
        if (idx === -1) {
          newParts.push(part);
          continue;
        }
        if (idx > 0) newParts.push(part.slice(0, idx));
        newParts.push(match);
        if (idx + match.label.length < part.length) newParts.push(part.slice(idx + match.label.length));
      }
      parts = newParts;
    }

    return (
      <>
        {parts.map((part, i) =>
          typeof part === 'string' ? (
            <span key={i}>{part}</span>
          ) : (
            <InlineTimerButton key={i} minutes={part.minutes} label={part.label} onStart={addTimer} />
          )
        )}
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center">
          <div className="text-sm text-muted-foreground font-body mb-4">
            Step {currentStep + 1} of {recipe.instructions.length}
          </div>
          <p className="font-body text-2xl md:text-4xl leading-relaxed max-w-2xl text-foreground">
            {renderStepWithTimers(recipe.instructions[currentStep])}
          </p>

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-10">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentStep((s) => Math.max(s - 1, 0))}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-5 w-5" /> Previous
            </Button>
            <Button
              size="lg"
              onClick={() => setCurrentStep((s) => Math.min(s + 1, recipe.instructions.length - 1))}
              disabled={currentStep === recipe.instructions.length - 1}
              className="gap-2"
            >
              Next <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-6">
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

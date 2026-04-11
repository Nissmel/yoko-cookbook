import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Timer, X, Pause, Play } from 'lucide-react';

interface TimerInstance {
  id: string;
  label: string;
  totalSeconds: number;
  remaining: number;
  running: boolean;
}

export function useTimerParser(text: string): { minutes: number; label: string }[] {
  const results: { minutes: number; label: string }[] = [];
  // Match patterns like "30 minut", "15 min", "2 godziny", "1.5h", "45 minutes", "1 godz"
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(?:godzin[yę]?|godz\.?|h)\b/gi,
    /(\d+(?:[.,]\d+)?)\s*(?:minut[yę]?|min\.?)\b/gi,
    /(\d+(?:[.,]\d+)?)\s*(?:sekund[yę]?|sek\.?|s)\b/gi,
    /(\d+(?:[.,]\d+)?)\s*(?:hours?)\b/gi,
    /(\d+(?:[.,]\d+)?)\s*(?:minutes?)\b/gi,
  ];

  // Hours
  for (const match of text.matchAll(patterns[0])) {
    const hrs = parseFloat(match[1].replace(',', '.'));
    results.push({ minutes: Math.round(hrs * 60), label: match[0] });
  }
  for (const match of text.matchAll(patterns[3])) {
    const hrs = parseFloat(match[1].replace(',', '.'));
    results.push({ minutes: Math.round(hrs * 60), label: match[0] });
  }
  // Minutes
  for (const match of text.matchAll(patterns[1])) {
    results.push({ minutes: Math.round(parseFloat(match[1].replace(',', '.'))), label: match[0] });
  }
  for (const match of text.matchAll(patterns[4])) {
    results.push({ minutes: Math.round(parseFloat(match[1].replace(',', '.'))), label: match[0] });
  }
  // Seconds → convert to minutes (min 1)
  for (const match of text.matchAll(patterns[2])) {
    const secs = parseFloat(match[1].replace(',', '.'));
    results.push({ minutes: Math.max(1, Math.round(secs / 60)), label: match[0] });
  }

  // Deduplicate
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.minutes}-${r.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CookingTimerBar({ timers, onRemove, onToggle }: {
  timers: TimerInstance[];
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  if (timers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 bg-card/80 backdrop-blur-sm border-b border-border">
      {timers.map((t) => {
        const done = t.remaining <= 0;
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-body transition-colors ${
              done
                ? 'bg-destructive/10 text-destructive animate-pulse border border-destructive/30'
                : 'bg-primary/10 text-primary border border-primary/20'
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            <span className="font-semibold tabular-nums">{done ? '0:00' : formatTime(t.remaining)}</span>
            <span className="text-xs opacity-70 max-w-[80px] truncate">{t.label}</span>
            {!done && (
              <button onClick={() => onToggle(t.id)} className="hover:opacity-70">
                {t.running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>
            )}
            <button onClick={() => onRemove(t.id)} className="hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useTimers() {
  const [timers, setTimers] = useState<TimerInstance[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element for alarm
  useEffect(() => {
    // Use a simple beep via Web Audio API
    return () => {
      audioRef.current = null;
    };
  }, []);

  const playAlarm = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 500);
      // Play 3 beeps
      setTimeout(() => {
        const ctx2 = new AudioContext();
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.frequency.value = 880;
        osc2.type = 'sine';
        gain2.gain.value = 0.3;
        osc2.start();
        setTimeout(() => { osc2.stop(); ctx2.close(); }, 500);
      }, 700);
    } catch {
      // Audio not available
    }
  }, []);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        let alarmNeeded = false;
        const next = prev.map((t) => {
          if (!t.running || t.remaining <= 0) return t;
          const newRemaining = t.remaining - 1;
          if (newRemaining <= 0) alarmNeeded = true;
          return { ...t, remaining: newRemaining, running: newRemaining > 0 ? t.running : false };
        });
        if (alarmNeeded) playAlarm();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playAlarm]);

  const addTimer = useCallback((minutes: number, label: string) => {
    const id = `timer-${Date.now()}-${Math.random()}`;
    setTimers((prev) => [...prev, { id, label, totalSeconds: minutes * 60, remaining: minutes * 60, running: true }]);
  }, []);

  const removeTimer = useCallback((id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTimer = useCallback((id: string) => {
    setTimers((prev) => prev.map((t) => t.id === id ? { ...t, running: !t.running } : t));
  }, []);

  return { timers, addTimer, removeTimer, toggleTimer };
}

export function InlineTimerButton({ minutes, label, onStart }: {
  minutes: number;
  label: string;
  onStart: (minutes: number, label: string) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onStart(minutes, label); }}
      className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-sm font-body hover:bg-primary/20 transition-colors border border-primary/20"
      title={`Start ${minutes} min timer`}
    >
      <Timer className="h-3 w-3" />
      {label}
    </button>
  );
}

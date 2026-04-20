import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface ThemeSwitcherProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export default function ThemeSwitcher({ variant = 'icon', className }: ThemeSwitcherProps) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="icon" className={cn('text-muted-foreground', className)} aria-label="Change theme">
            <Palette className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className={cn('gap-2 text-muted-foreground', className)}>
            <Palette className="h-4 w-4" /> Theme
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="px-2 py-1.5">
          <p className="font-display text-sm font-semibold text-foreground">Choose a theme</p>
          <p className="font-body text-xs text-muted-foreground">Try different color palettes</p>
        </div>
        <div className="space-y-1 mt-1">
          {themes.map((t) => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors font-body',
                  active ? 'bg-accent' : 'hover:bg-muted/60'
                )}
              >
                <div className="flex -space-x-1 shrink-0">
                  {t.swatches.map((color, i) => (
                    <span
                      key={i}
                      className="h-6 w-6 rounded-full border-2 border-card shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                </div>
                {active && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

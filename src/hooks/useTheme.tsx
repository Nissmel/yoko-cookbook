import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeId = 'linen' | 'sage' | 'tomato' | 'midnight' | 'nordic' | 'berry';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  className: string; // class applied to <html>; '' = default :root
  swatches: [string, string, string]; // bg, primary, accent (CSS colors for preview)
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'linen',
    name: 'Linen & Honey',
    description: 'Warm cream with golden honey accents',
    className: '',
    swatches: ['hsl(36 33% 95%)', 'hsl(42 78% 49%)', 'hsl(28 20% 56%)'],
  },
  {
    id: 'sage',
    name: 'Sage Kitchen',
    description: 'Fresh herbal greens',
    className: 'theme-sage',
    swatches: ['hsl(90 25% 96%)', 'hsl(150 40% 38%)', 'hsl(100 20% 50%)'],
  },
  {
    id: 'tomato',
    name: 'Tomato Trattoria',
    description: 'Warm Italian rustic',
    className: 'theme-tomato',
    swatches: ['hsl(24 50% 96%)', 'hsl(8 72% 50%)', 'hsl(90 30% 38%)'],
  },
  {
    id: 'midnight',
    name: 'Midnight Bistro',
    description: 'Dark moody with copper accents',
    className: 'theme-midnight',
    swatches: ['hsl(220 20% 9%)', 'hsl(22 75% 55%)', 'hsl(220 12% 35%)'],
  },
  {
    id: 'nordic',
    name: 'Nordic Frost',
    description: 'Cool minimal scandinavian',
    className: 'theme-nordic',
    swatches: ['hsl(210 25% 97%)', 'hsl(210 75% 45%)', 'hsl(215 18% 50%)'],
  },
  {
    id: 'berry',
    name: 'Berry Patisserie',
    description: 'Playful pink and plum',
    className: 'theme-berry',
    swatches: ['hsl(340 35% 97%)', 'hsl(330 65% 50%)', 'hsl(280 30% 50%)'],
  },
];

const STORAGE_KEY = 'recipe-keeper-theme';
const ALL_CLASSES = THEMES.map((t) => t.className).filter(Boolean);

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themes: ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  ALL_CLASSES.forEach((c) => root.classList.remove(c));
  const meta = THEMES.find((t) => t.id === id);
  if (meta && meta.className) root.classList.add(meta.className);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'linen';
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return stored && THEMES.some((t) => t.id === stored) ? stored : 'linen';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

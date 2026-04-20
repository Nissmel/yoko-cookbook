import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeId = 'linen' | 'sage' | 'tomato' | 'midnight' | 'nordic' | 'berry' | 'apricot' | 'terracotta' | 'tangerine';

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
    swatches: ['hsl(36 33% 95%)', 'hsl(28 92% 64%)', 'hsl(28 20% 56%)'],
  },
  {
    id: 'sage',
    name: 'Sage Kitchen',
    description: 'Paper cream with herbal green accents',
    className: 'theme-sage',
    swatches: ['hsl(60 20% 95%)', 'hsl(150 38% 36%)', 'hsl(100 18% 48%)'],
  },
  {
    id: 'tomato',
    name: 'Tomato Trattoria',
    description: 'Paper cream with warm Italian red',
    className: 'theme-tomato',
    swatches: ['hsl(30 28% 95%)', 'hsl(8 70% 48%)', 'hsl(90 28% 36%)'],
  },
  {
    id: 'midnight',
    name: 'Midnight Bistro',
    description: 'Dark paper-noir with copper accents',
    className: 'theme-midnight',
    swatches: ['hsl(30 8% 10%)', 'hsl(22 75% 55%)', 'hsl(30 8% 38%)'],
  },
  {
    id: 'nordic',
    name: 'Nordic Frost',
    description: 'Paper cream with cool blue accents',
    className: 'theme-nordic',
    swatches: ['hsl(210 14% 96%)', 'hsl(210 72% 44%)', 'hsl(215 16% 48%)'],
  },
  {
    id: 'berry',
    name: 'Berry Patisserie',
    description: 'Paper cream with playful berry accents',
    className: 'theme-berry',
    swatches: ['hsl(340 18% 96%)', 'hsl(330 62% 48%)', 'hsl(280 28% 48%)'],
  },
  {
    id: 'apricot',
    name: 'Apricot Orchard',
    description: 'Paper cream with juicy apricot accents',
    className: 'theme-apricot',
    swatches: ['hsl(32 30% 95%)', 'hsl(24 95% 60%)', 'hsl(30 22% 50%)'],
  },
  {
    id: 'terracotta',
    name: 'Terracotta Studio',
    description: 'Paper cream with earthy brick-orange accents',
    className: 'theme-terracotta',
    swatches: ['hsl(28 24% 94%)', 'hsl(18 78% 58%)', 'hsl(24 20% 46%)'],
  },
  {
    id: 'tangerine',
    name: 'Tangerine Market',
    description: 'Paper cream with vivid tangerine accents',
    className: 'theme-tangerine',
    swatches: ['hsl(36 30% 95%)', 'hsl(22 100% 58%)', 'hsl(32 22% 48%)'],
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

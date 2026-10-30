'use client';

import { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { useThemeStore } from '@/store/theme.store';
import { applyTheme, getThemeByName, resolveCommunityTheme, type CommunityThemeColors } from '@/lib/themes';
import type { Theme } from '@community/shared';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (name: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, communityTheme }: { children: ReactNode; communityTheme?: { baseTheme: string; colors: CommunityThemeColors } }) {
  const { themeName, setThemeName, availableThemes } = useThemeStore();

  const effectiveName = themeName ?? communityTheme?.baseTheme ?? 'executive-glass';
  const theme = useMemo(() => resolveCommunityTheme(getThemeByName(effectiveName), communityTheme?.colors), [effectiveName, communityTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (name: string) => {
    setThemeName(name);
    applyTheme(resolveCommunityTheme(getThemeByName(name), communityTheme?.colors));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

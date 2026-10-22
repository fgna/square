'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useThemeStore } from '@/store/theme.store';
import { applyTheme, getThemeByName } from '@/lib/themes';
import type { Theme } from '@community/shared';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (name: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { themeName, setThemeName, availableThemes } = useThemeStore();

  useEffect(() => {
    const theme = getThemeByName(themeName);
    applyTheme(theme);
  }, [themeName]);

  const theme = getThemeByName(themeName);

  const setTheme = (name: string) => {
    setThemeName(name);
    applyTheme(getThemeByName(name));
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

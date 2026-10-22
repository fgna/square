import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { themes } from '@/lib/themes';
import type { Theme } from '@community/shared';

interface ThemeStore {
  themeName: string;
  availableThemes: Theme[];
  setThemeName: (name: string) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      themeName: 'executive-glass',
      availableThemes: themes,
      setThemeName: (name: string) => set({ themeName: name }),
    }),
    {
      name: 'community-theme',
      partialize: (state) => ({ themeName: state.themeName }),
    },
  ),
);

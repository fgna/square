'use client';

import { Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeSwitcher() {
  const t = useTranslations('themeSwitcherUI');
  const { theme, setTheme, themes } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          aria-label={t('switch')}
        >
          <Palette size={18} style={{ color: 'var(--theme-text-muted)' }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('theme')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => setTheme(t.name)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 border"
              style={{
                background: t.colors.primary,
                borderColor: t.name === theme.name ? 'var(--theme-text)' : 'transparent',
                boxShadow: t.name === theme.name ? `0 0 0 2px var(--theme-primary)` : 'none',
              }}
            />
            <span style={{ color: t.name === theme.name ? 'var(--theme-primary)' : 'var(--theme-text)' }}>
              {t.displayName}
            </span>
            {t.name === theme.name && (
              <span className="ml-auto text-xs" style={{ color: 'var(--theme-primary)' }}>✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

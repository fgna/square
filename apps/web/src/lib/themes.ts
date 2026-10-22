import type { Theme } from '@community/shared';

export const themes: Theme[] = [
  {
    name: 'executive-glass',
    displayName: 'Executive Glass',
    description: 'Dark luxury with gold accents and glassmorphism effects',
    colors: {
      primary: '#c5a880',
      secondary: '#6366f1',
      accent: '#c5a880',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      background: '#090d16',
      surface: 'rgba(10, 15, 26, 0.85)',
      card: 'rgba(17, 24, 39, 0.7)',
      text: '#f3f4f6',
      textMuted: '#9ca3af',
      border: 'rgba(255, 255, 255, 0.08)',
      glow: 'rgba(197, 168, 128, 0.25)',
    },
    effects: { glassmorphism: true, shadows: true, gradients: true, blur: '16px' },
    sidebarWidth: '280px',
  },
  {
    name: 'corporate-light',
    displayName: 'Corporate Light',
    description: 'Clean professional light theme',
    colors: {
      primary: '#2563eb',
      secondary: '#7c3aed',
      accent: '#2563eb',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
      background: '#f8fafc',
      surface: 'rgba(255, 255, 255, 0.95)',
      card: 'rgba(255, 255, 255, 0.9)',
      text: '#0f172a',
      textMuted: '#64748b',
      border: 'rgba(0, 0, 0, 0.08)',
      glow: 'rgba(37, 99, 235, 0.15)',
    },
    effects: { glassmorphism: false, shadows: true, gradients: false, blur: '0px' },
    sidebarWidth: '280px',
  },
  {
    name: 'high-contrast',
    displayName: 'High Contrast',
    description: 'Maximum accessibility with stark contrast',
    colors: {
      primary: '#ffffff',
      secondary: '#ffff00',
      accent: '#00ffff',
      success: '#00ff00',
      warning: '#ffff00',
      danger: '#ff0000',
      background: '#000000',
      surface: '#0a0a0a',
      card: '#111111',
      text: '#ffffff',
      textMuted: '#cccccc',
      border: 'rgba(255, 255, 255, 0.3)',
      glow: 'rgba(255, 255, 255, 0.1)',
    },
    effects: { glassmorphism: false, shadows: false, gradients: false, blur: '0px' },
    sidebarWidth: '280px',
  },
];

export const defaultTheme = themes[0];

export function getThemeByName(name: string): Theme {
  return themes.find((t) => t.name === name) || defaultTheme;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.style.setProperty('--theme-primary', theme.colors.primary);
  root.style.setProperty('--theme-secondary', theme.colors.secondary);
  root.style.setProperty('--theme-accent', theme.colors.accent);
  root.style.setProperty('--theme-success', theme.colors.success);
  root.style.setProperty('--theme-warning', theme.colors.warning);
  root.style.setProperty('--theme-danger', theme.colors.danger);
  root.style.setProperty('--theme-background', theme.colors.background);
  root.style.setProperty('--theme-surface', theme.colors.surface);
  root.style.setProperty('--theme-card', theme.colors.card);
  root.style.setProperty('--theme-text', theme.colors.text);
  root.style.setProperty('--theme-text-muted', theme.colors.textMuted);
  root.style.setProperty('--theme-border', theme.colors.border || 'rgba(255,255,255,0.08)');
  root.style.setProperty('--theme-glow', theme.colors.glow || 'rgba(197,168,128,0.25)');
  root.style.setProperty('--theme-blur', theme.effects.blur || '16px');
  root.style.setProperty('--sidebar-width', theme.sidebarWidth || '280px');

  root.setAttribute('data-theme', theme.name);
}

import type { CSSProperties } from 'react';

/**
 * One look for selectable topic chips (interests, topics of courses and
 * events, tags in the composer). Chips used to take each category's own
 * colour, and categories without one produced "var(--theme-primary)20" — not
 * a colour at all — so some selected chips had no background or border.
 * Selected chips now all use the theme's primary colour.
 */
export function chipStyle(selected: boolean): CSSProperties {
  return selected
    ? {
        background: 'color-mix(in srgb, var(--theme-primary) 14%, transparent)',
        color: 'var(--theme-primary)',
        border: '1.5px solid color-mix(in srgb, var(--theme-primary) 55%, transparent)',
      }
    : {
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--theme-text-muted)',
        border: '1.5px solid var(--theme-border)',
      };
}

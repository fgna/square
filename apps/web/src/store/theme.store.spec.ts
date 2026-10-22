import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from './theme.store';

function resetStore() {
  useThemeStore.setState({ themeName: 'executive-glass' });
  localStorage.clear();
}

describe('useThemeStore', () => {
  beforeEach(resetStore);

  it('defaults to executive-glass theme', () => {
    expect(useThemeStore.getState().themeName).toBe('executive-glass');
  });

  it('exposes available themes', () => {
    const { availableThemes } = useThemeStore.getState();
    expect(availableThemes.length).toBeGreaterThan(0);
    expect(availableThemes.every((t) => typeof t.name === 'string')).toBe(true);
  });

  it('setThemeName updates the active theme', () => {
    useThemeStore.getState().setThemeName('corporate-light');
    expect(useThemeStore.getState().themeName).toBe('corporate-light');
  });

  it('setThemeName can be called multiple times', () => {
    useThemeStore.getState().setThemeName('high-contrast');
    useThemeStore.getState().setThemeName('executive-glass');
    expect(useThemeStore.getState().themeName).toBe('executive-glass');
  });

  it('available themes include executive-glass', () => {
    const names = useThemeStore.getState().availableThemes.map((t) => t.name);
    expect(names).toContain('executive-glass');
  });
});

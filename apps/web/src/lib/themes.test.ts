import { describe, it, expect } from 'vitest';
import { getThemeByName, resolveCommunityTheme, contrastForeground } from './themes';

describe('community theme overrides', () => {
  it('preserves built-in theme defaults without overrides', () => {
    const original = getThemeByName('corporate-light');
    expect(resolveCommunityTheme(original)).toEqual(original);
  });
  it('changes only selected colors and retains visual effects', () => {
    const base = getThemeByName('executive-glass');
    const custom = resolveCommunityTheme(base, { primary: '#123456', accent: '#abcdef' });
    expect(custom.colors.primary).toBe('#123456');
    expect(custom.colors.secondary).toBe(base.colors.secondary);
    expect(custom.effects).toEqual(base.effects);
    expect(base.colors.primary).not.toBe('#123456');
  });
  it('derives readable foregrounds from bright and dark brand colors', () => {
    expect(contrastForeground('#ffffff')).toBe('#000000');
    expect(contrastForeground('#000000')).toBe('#ffffff');
    expect(contrastForeground('#ffff00')).toBe('#000000');
  });
  it('does not accept malformed color strings', () => {
    const base = getThemeByName('high-contrast');
    expect(resolveCommunityTheme(base, { primary: 'url(javascript:alert(1))' }).colors.primary).toBe(base.colors.primary);
  });
});

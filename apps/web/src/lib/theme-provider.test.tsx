import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ThemeProvider } from './theme-provider';
import { useThemeStore } from '@/store/theme.store';

afterEach(() => {
  cleanup();
  useThemeStore.setState({ themeName: null });
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.cssText = '';
});

describe('community branding in the active theme provider', () => {
  it('uses separate branding in independent community mounts', async () => {
    const first = render(
      <ThemeProvider communityTheme={{ baseTheme: 'corporate-light', colors: { primary: '#245A81' } }}>
        <span>Community A</span>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#245A81'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('corporate-light');
    first.unmount();

    render(
      <ThemeProvider communityTheme={{ baseTheme: 'corporate-light', colors: { primary: '#A82362' } }}>
        <span>Community B</span>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#A82362'));
  });

  it('keeps member theme choice and community colors together', async () => {
    useThemeStore.setState({ themeName: 'executive-glass' });
    render(
      <ThemeProvider communityTheme={{ baseTheme: 'corporate-light', colors: { accent: '#9A5511' } }}>
        <span>Member</span>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('executive-glass'));
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('#9A5511');
  });

  it('preserves the accessibility theme with custom instance branding', async () => {
    useThemeStore.setState({ themeName: 'high-contrast' });
    render(
      <ThemeProvider communityTheme={{ baseTheme: 'corporate-light', colors: { primary: '#000000' } }}>
        <span>Accessible</span>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast'));
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#ffffff');
  });
});

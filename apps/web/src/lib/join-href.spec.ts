import { describe, it, expect, afterEach, vi } from 'vitest';
import { getServerBranding, joinHref } from './server-branding';

describe('where "join" leads', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('goes to the join page while sign-ups need an invitation', () => {
    expect(joinHref({ allowSignups: false, joinUrl: 'https://go.example.com/join' })).toBe('https://go.example.com/join');
  });

  it('keeps the sign-up form when sign-ups are open or no page is set', () => {
    expect(joinHref({ allowSignups: true, joinUrl: 'https://go.example.com/join' })).toBe('/register');
    expect(joinHref({ allowSignups: false, joinUrl: null })).toBe('/register');
  });

  it('reads the setting from the API and ignores anything but https', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ platformName: 'X', allowSignups: false, joinUrl: 'javascript:alert(1)' }) }));
    expect(await getServerBranding()).toMatchObject({ allowSignups: false, joinUrl: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ platformName: 'X', allowSignups: false, joinUrl: 'https://go.example.com/join' }) }));
    expect(joinHref(await getServerBranding())).toBe('https://go.example.com/join');
  });
});

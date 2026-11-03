import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiOrigin, getServerBranding, iconLetter } from './server-branding';

describe('server-side branding', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('reads name and icon from the API the web server reaches', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api:3001/');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ platformName: ' GrowthLeaders ', appIconUrl: '/uploads/uploads/u1/icon.png' }) });
    vi.stubGlobal('fetch', fetch);
    expect(await getServerBranding()).toEqual({ platformName: 'GrowthLeaders', appIconUrl: '/uploads/uploads/u1/icon.png' });
    expect(fetch.mock.calls[0][0]).toBe('http://api:3001/api/platform/branding');
  });

  it('never takes an icon from outside the own uploads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ platformName: 'X', appIconUrl: 'https://evil.example/x.png' }) }));
    expect((await getServerBranding()).appIconUrl).toBeNull();
  });

  it('uses the internal address before the public one', () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://community.example');
    expect(apiOrigin()).toBe('https://community.example');
  });

  it('takes the first letter of the name for the generated icon', () => {
    expect(iconLetter('growthLeaders')).toBe('G');
    expect(iconLetter('  ')).toBe('C');
    expect(iconLetter('Ärzte')).toBe('Ä');
  });
});

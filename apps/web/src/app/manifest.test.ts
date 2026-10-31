import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from './manifest';

function branding(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

describe('installable PWA manifest', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defines standalone identity and correct scope', async () => {
    branding({ platformName: 'Community Platform', appIconUrl: null });
    const value = await manifest();
    expect(value.id).toBe('/');
    expect(value.start_url).toBe('/');
    expect(value.scope).toBe('/');
    expect(value.display).toBe('standalone');
  });

  it('uses the name from Admin → Settings for the home screen', async () => {
    branding({ platformName: 'GrowthLeaders', appIconUrl: '/uploads/uploads/u1/icon.png' });
    expect(await manifest()).toMatchObject({ name: 'GrowthLeaders', short_name: 'GrowthLeaders' });
  });

  it('falls back to the neutral name when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await manifest()).name).toBe('Community Platform');
    branding({}, false);
    expect((await manifest()).name).toBe('Community Platform');
  });

  it('advertises PNG icons with 192 and 512 pixel dimensions', async () => {
    branding({ platformName: 'Community Platform' });
    const icons = (await manifest()).icons ?? [];
    expect(icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
    ]));
  });
});

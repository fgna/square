import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('installable PWA manifest', () => {
  it('defines standalone identity and correct scope', () => {
    const value = manifest();
    expect(value.id).toBe('/');
    expect(value.start_url).toBe('/');
    expect(value.scope).toBe('/');
    expect(value.display).toBe('standalone');
    expect(value.name).toBe('Community Platform');
  });

  it('advertises PNG icons with 192 and 512 pixel dimensions', () => {
    const icons = manifest().icons ?? [];
    expect(icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
    ]));
  });
});

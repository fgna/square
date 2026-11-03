import { describe, expect, it } from 'vitest';
import { disabledApiCapability, parseCapabilities } from './capabilities';

describe('gamification capability boundaries (#107)', () => {
  it('accepts gamification alongside all current main capabilities', () => {
    const enabled = parseCapabilities('feed,messages,events,courses,journal,assessments,testimonials,recordings,gamification');
    expect(enabled.has('gamification')).toBe(true);
    expect(enabled.has('recordings')).toBe(true);
    expect(enabled.has('testimonials')).toBe(true);
  });

  it('rejects all gamification API routes when the capability is disabled', () => {
    const enabled = parseCapabilities('feed,events');
    for (const path of [
      '/api/gamification/wallet',
      '/api/gamification/transactions',
      '/api/gamification/inventory',
      '/api/gamification/items',
      '/api/gamification/purchase',
      '/api/gamification/equipment',
      '/api/gamification/issuer/events',
      '/api/gamification/admin/rewards',
      '/api/gamification/admin/events',
      '/api/gamification/admin/items',
    ]) {
      expect(disabledApiCapability(path, enabled)).toBe('gamification');
    }
    expect(disabledApiCapability('/api/gamification/wallet?check=true', enabled)).toBe('gamification');
    expect(disabledApiCapability('/api/gamificationevil/wallet', enabled)).toBeUndefined();
  });

  it('allows gamification routes when enabled and preserves other capability guards', () => {
    const enabled = parseCapabilities('gamification');
    expect(disabledApiCapability('/api/gamification/issuer/events', enabled)).toBeUndefined();
    expect(disabledApiCapability('/api/posts', enabled)).toBe('feed');
    expect(disabledApiCapability('/api/events/recordings', enabled)).toBe('recordings');
  });

  it('fails closed for unknown capability entries', () => {
    expect(() => parseCapabilities('gamification,unknown')).toThrow('Unknown SQUARE_CAPABILITIES');
  });
});

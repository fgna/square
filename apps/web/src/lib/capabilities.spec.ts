import { describe, expect, it } from 'vitest';
import { CAPABILITIES, isPathEnabled, parseCapabilities } from './capabilities';

describe('capability routing', () => {
  it('preserves full-featured defaults', () => expect([...parseCapabilities(undefined)]).toEqual(CAPABILITIES));
  it('keeps identity and admin user management available', () => {
    const identityOnly = parseCapabilities('');
    expect(isPathEnabled('/dashboard', identityOnly)).toBe(true);
    expect(isPathEnabled('/admin/users', identityOnly)).toBe(true);
    for (const path of ['/feed', '/messages', '/events', '/courses', '/assessment', '/p/journal',
      '/admin/courses', '/admin/assessment', '/testimonials', '/admin/testimonials', '/recordings']) expect(isPathEnabled(path, identityOnly)).toBe(false);
  });
  it('permits independently enabled testimonials and recordings', () => {
    const enabled = parseCapabilities('testimonials,recordings');
    expect(isPathEnabled('/testimonials', enabled)).toBe(true);
    expect(isPathEnabled('/admin/testimonials', enabled)).toBe(true);
    expect(isPathEnabled('/recordings', enabled)).toBe(true);
    expect(isPathEnabled('/events', enabled)).toBe(false);
  });
  it('rejects invalid flags and supports selected capabilities', () => {
    expect(() => parseCapabilities('feed,unknown')).toThrow(/unknown/);
    expect(isPathEnabled('/courses/abc', parseCapabilities('courses'))).toBe(true);
    expect(isPathEnabled('/feed', parseCapabilities('courses'))).toBe(false);
  });
});

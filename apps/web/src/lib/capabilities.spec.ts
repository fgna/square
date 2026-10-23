import { describe, expect, it } from 'vitest';
import { CAPABILITIES, isPathEnabled, parseCapabilities } from './capabilities';

describe('capability routing', () => {
  it('preserves full-featured defaults', () => expect([...parseCapabilities(undefined)]).toEqual(CAPABILITIES));
  it('keeps identity and admin user management available', () => {
    const identityOnly = parseCapabilities('');
    expect(isPathEnabled('/dashboard', identityOnly)).toBe(true);
    expect(isPathEnabled('/admin/users', identityOnly)).toBe(true);
    for (const path of ['/feed', '/messages', '/events', '/courses', '/assessment', '/p/journal',
      '/admin/courses', '/admin/assessment']) expect(isPathEnabled(path, identityOnly)).toBe(false);
  });
  it('rejects invalid flags and supports selected capabilities', () => {
    expect(() => parseCapabilities('feed,unknown')).toThrow(/unknown/);
    expect(isPathEnabled('/courses/abc', parseCapabilities('courses'))).toBe(true);
    expect(isPathEnabled('/feed', parseCapabilities('courses'))).toBe(false);
  });
});

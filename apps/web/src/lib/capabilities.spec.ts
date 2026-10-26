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

describe('learning group web capability', () => {
  it('accepts the learning-groups capability shared with the API', () => {
    expect(parseCapabilities('courses,learning-groups').has('learning-groups')).toBe(true);
  });

  it('blocks the plugin groups route when disabled, without blocking math tasks', () => {
    const enabled = parseCapabilities('courses');
    expect(isPathEnabled('/p/turbo-mathe/groups', enabled)).toBe(false);
    expect(isPathEnabled('/p/turbo-mathe/groups/invites', enabled)).toBe(false);
    expect(isPathEnabled('/p/turbo-mathe', enabled)).toBe(true);
  });

  it('allows group routes only when the group capability is enabled', () => {
    const enabled = parseCapabilities('courses,learning-groups');
    expect(isPathEnabled('/p/turbo-mathe/groups', enabled)).toBe(true);
    expect(isPathEnabled('/p/turbo-mathe/groups/invites', enabled)).toBe(true);
  });

  it('rejects misspelled capability flags', () => {
    expect(() => parseCapabilities('courses,learning-group')).toThrow(/learning-group/);
  });
});

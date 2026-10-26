import { describe, expect, it } from 'vitest';
import { CAPABILITIES, disabledApiCapability, parseCapabilities } from './capabilities';

describe('instance capabilities', () => {
  it('keeps full-featured instances unchanged by default', () => {
    expect([...parseCapabilities(undefined)]).toEqual(CAPABILITIES);
  });
  it('allows an identity-only instance and blocks every optional API surface', () => {
    const enabled = parseCapabilities('');
    for (const path of ['/api/posts', '/api/messages/conversations', '/api/events', '/api/courses',
      '/api/p/journal/entries', '/api/learning-groups', '/api/assessments', '/api/admin/events', '/api/admin/assessment']) {
      expect(disabledApiCapability(path, enabled)).toBeTruthy();
    }
    expect(disabledApiCapability('/api/auth/login', enabled)).toBeUndefined();
    expect(disabledApiCapability('/api/users/me', enabled)).toBeUndefined();
  });
  it('blocks direct group endpoints when a restricted instance omits learning-groups', () => {
    const restricted = parseCapabilities('courses');
    expect(disabledApiCapability('/api/learning-groups', restricted)).toBe('learning-groups');
    expect(disabledApiCapability('/api/learning-groups/invites/a/accept', restricted)).toBe('learning-groups');
    expect(disabledApiCapability('/api/learning-groups/g1/messages', restricted)).toBe('learning-groups');
    expect(disabledApiCapability('/api/p/turbo-mathe/groups', restricted)).toBeUndefined();
    const allowed = parseCapabilities('courses,learning-groups');
    expect(disabledApiCapability('/api/learning-groups/invites', allowed)).toBeUndefined();
  });
  it('rejects typos before startup', () => {
    expect(() => parseCapabilities('feed,mesages')).toThrow(/mesages/);
  });
  it('enables capabilities independently', () => {
    const enabled = parseCapabilities('courses,assessments');
    expect(disabledApiCapability('/api/courses', enabled)).toBeUndefined();
    expect(disabledApiCapability('/api/assessments', enabled)).toBeUndefined();
    expect(disabledApiCapability('/api/events', enabled)).toBe('events');
  });
});

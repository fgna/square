import { describe, expect, it } from 'vitest';
import { CAPABILITIES, disabledApiCapability, parseCapabilities } from './capabilities';

describe('instance capabilities', () => {
  it('keeps full-featured instances unchanged by default', () => {
    expect([...parseCapabilities(undefined)]).toEqual(CAPABILITIES);
  });
  it('allows an identity-only instance and blocks every optional API surface', () => {
    const enabled = parseCapabilities('');
    for (const path of ['/api/posts', '/api/messages/conversations', '/api/events', '/api/courses',
      '/api/p/journal/entries', '/api/assessments', '/api/testimonials', '/api/events/recordings/all', '/api/events/123/recordings', '/api/admin/events', '/api/admin/assessment']) {
      expect(disabledApiCapability(path, enabled)).toBeTruthy();
    }
    expect(disabledApiCapability('/api/auth/login', enabled)).toBeUndefined();
    expect(disabledApiCapability('/api/users/me', enabled)).toBeUndefined();
  });
  it('switches testimonials and recordings independently from events and journal', () => {
    const enabled = parseCapabilities('events,journal');
    expect(disabledApiCapability('/api/events', enabled)).toBeUndefined();
    expect(disabledApiCapability('/api/p/journal/entries', enabled)).toBeUndefined();
    for (const path of ['/api/testimonials', '/api/testimonials/admin', '/api/testimonials/a/like', '/api/events/recordings/all', '/api/events/recordings/r/attachments', '/api/events/e/recordings']) {
      expect(disabledApiCapability(path, enabled)).toBeTruthy();
    }
    const independent = parseCapabilities('testimonials,recordings');
    expect(disabledApiCapability('/api/testimonials', independent)).toBeUndefined();
    expect(disabledApiCapability('/api/events/recordings/all', independent)).toBeUndefined();
    expect(disabledApiCapability('/api/events', independent)).toBe('events');
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

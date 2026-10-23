import { describe, expect, it } from 'vitest';
import { type ExecutionContext } from '@nestjs/common';
import { CapabilityGuard } from './capabilities.guard';
import { disabledApiCapability, parseCapabilities } from './capabilities';

describe('capability HTTP route boundary', () => {
  const disabled = parseCapabilities('');

  it('blocks direct API URLs for every optional feature', () => {
    for (const path of [
      '/api/posts', '/api/posts/p1/comments', '/api/messages/conversations',
      '/api/events/e1', '/api/event-proposals', '/api/calendar',
      '/api/courses/c1', '/api/p/journal/entries', '/api/assessments',
      '/api/admin/events', '/api/admin/courses', '/api/admin/assessment',
    ]) {
      expect(disabledApiCapability(path + '?page=1', disabled), path).toBeDefined();
    }
  });

  it('retains login and user-profile APIs when features are disabled', () => {
    for (const path of ['/api/auth/login', '/api/auth/refresh', '/api/users/me', '/health']) {
      expect(disabledApiCapability(path, disabled), path).toBeUndefined();
    }
  });

  it('honors request originalUrl even if Express rewrites url', () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ originalUrl: '/api/auth/login', url: '/api/posts' }) }),
    } as unknown as ExecutionContext;
    expect(new CapabilityGuard().canActivate(context)).toBe(true);
  });
});

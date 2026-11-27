import { describe, it, expect } from 'vitest';
import { encodeLastPage, instanceStartPage, isResumable, resumeTarget, startPageChoice, RESUME_WITHIN_MS } from './start-page';

const now = Date.parse('2026-11-30T08:00:00Z');
const home = '/dashboard';

describe('start page choice', () => {
  it('is off unless the instance turns it on', () => {
    expect(instanceStartPage(undefined)).toBe('home');
    expect(instanceStartPage('')).toBe('home');
    expect(instanceStartPage('last')).toBe('last');
  });

  it("prefers the member's choice on this device", () => {
    expect(startPageChoice('home', 'last')).toBe('home');
    expect(startPageChoice('last', 'home')).toBe('last');
    expect(startPageChoice(undefined, 'last')).toBe('last');
    expect(startPageChoice('junk', 'home')).toBe('home');
  });
});

describe('remembered pages', () => {
  it('keeps ordinary pages with their query', () => {
    expect(isResumable('/courses/abc?lesson=2', home)).toBe(true);
    expect(isResumable('/p/growth/journal', home)).toBe(true);
  });

  it('skips the start page, settings, admin, sign-in and foreign addresses', () => {
    for (const path of ['/', '/dashboard', '/settings', '/admin/users', '/login', '/register', '/api/x', '/get-app', '//evil.test/x', 'https://evil.test', '']) {
      expect(isResumable(path, home), path).toBe(false);
    }
    expect(isResumable('/p/game', '/p/game')).toBe(false);
  });
});

describe('resumeTarget', () => {
  const opts = { choice: 'last' as const, home, now };

  it('returns the last page within 24 hours', () => {
    expect(resumeTarget(encodeLastPage('/feed/p1', now - 60_000), opts)).toBe('/feed/p1');
    expect(resumeTarget(encodeLastPage('/courses/a?x=1', now - RESUME_WITHIN_MS + 1000), opts)).toBe('/courses/a?x=1');
  });

  it('opens the start page after 24 hours', () => {
    expect(resumeTarget(encodeLastPage('/feed/p1', now - RESUME_WITHIN_MS - 1), opts)).toBeNull();
  });

  it('opens the start page when the member chose it', () => {
    expect(resumeTarget(encodeLastPage('/feed/p1', now), { ...opts, choice: 'home' })).toBeNull();
  });

  it('ignores broken or forged cookies', () => {
    for (const cookie of [undefined, '', 'abc', '.%2Ffeed', `${now}.%E0%A4%A`, `${now}.${encodeURIComponent('//evil.test')}`, `${now}.${encodeURIComponent('/settings')}`, `${now + RESUME_WITHIN_MS}.%2Ffeed`]) {
      expect(resumeTarget(cookie, opts), String(cookie)).toBeNull();
    }
  });
});

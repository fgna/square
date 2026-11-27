import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { encodeLastPage } from './lib/start-page';

describe('opening the app picks up where the member left off', () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = original;
    vi.unstubAllEnvs();
  });

  function open(cookie: string, path = '/') {
    process.env.NEXT_PUBLIC_APP_URL = 'https://community.example.com';
    return middleware(new NextRequest(`https://community.example.com${path}`, { headers: { cookie } })).headers.get('location');
  }
  const last = (path: string, ago = 60_000) => `last-page=${encodeLastPage(path, Date.now() - ago)}`;

  it('keeps the dashboard where the instance did not turn it on', () => {
    expect(open(`auth-session=1; ${last('/feed/p1')}`)).toBe('https://community.example.com/dashboard');
  });

  it('opens the last page where the instance turned it on', () => {
    vi.stubEnv('NEXT_PUBLIC_START_PAGE', 'last');
    expect(open(`auth-session=1; ${last('/courses/c1?lesson=2')}`)).toBe('https://community.example.com/courses/c1?lesson=2');
  });

  it('lets a member choose the dashboard on this device', () => {
    vi.stubEnv('NEXT_PUBLIC_START_PAGE', 'last');
    expect(open(`auth-session=1; start-page=home; ${last('/feed/p1')}`)).toBe('https://community.example.com/dashboard');
  });

  it('lets a member choose resuming where the instance did not turn it on', () => {
    expect(open(`auth-session=1; start-page=last; ${last('/feed/p1')}`)).toBe('https://community.example.com/feed/p1');
  });

  it('falls back to the dashboard after 24 hours', () => {
    vi.stubEnv('NEXT_PUBLIC_START_PAGE', 'last');
    expect(open(`auth-session=1; ${last('/feed/p1', 25 * 60 * 60 * 1000)}`)).toBe('https://community.example.com/dashboard');
  });

  it('never resumes from the sign-in pages', () => {
    vi.stubEnv('NEXT_PUBLIC_START_PAGE', 'last');
    expect(open(`auth-session=1; ${last('/feed/p1')}`, '/login')).toBe('https://community.example.com/dashboard');
  });

  it('does nothing for visitors who are not signed in', () => {
    vi.stubEnv('NEXT_PUBLIC_START_PAGE', 'last');
    expect(open(last('/feed/p1'))).toBeNull();
  });
});

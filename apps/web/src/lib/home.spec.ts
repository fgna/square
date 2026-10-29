import { describe, expect, it } from 'vitest';
import { afterSignIn } from './home';

describe('afterSignIn', () => {
  it('returns to the page that asked for the sign-in', () => {
    expect(afterSignIn('/p/game/garage', '/p/game')).toBe('/p/game/garage');
    expect(afterSignIn('/courses/3?tab=2', '/dashboard')).toBe('/courses/3?tab=2');
  });

  it('otherwise goes to the start page', () => {
    expect(afterSignIn(null, '/p/game')).toBe('/p/game');
    expect(afterSignIn('', '/dashboard')).toBe('/dashboard');
  });

  it('never leaves the app or loops back to the sign-in', () => {
    for (const from of ['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/login?from=/x', '/register', '/auth/callback/google', '/api/auth/me']) {
      expect(afterSignIn(from, '/p/game')).toBe('/p/game');
    }
  });
});

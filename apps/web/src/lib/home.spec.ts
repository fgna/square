import { afterEach, describe, expect, it } from 'vitest';
import { afterSignIn, rememberReturn, takeReturn } from './home';

describe('afterSignIn', () => {
  it('returns to the page that asked for the sign-in', () => {
    expect(afterSignIn('/p/game/garage', '/p/game')).toBe('/p/game/garage');
    expect(afterSignIn('/courses/3?tab=2#x', '/dashboard')).toBe('/courses/3?tab=2#x');
  });

  it('otherwise goes to the start page', () => {
    expect(afterSignIn(null, '/p/game')).toBe('/p/game');
    expect(afterSignIn('', '/dashboard')).toBe('/dashboard');
  });

  it('never leaves the app, however the destination is written', () => {
    for (const from of ['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example',
      '/%09/evil.example', '/\\\\evil.example', 'javascript:alert(1)']) {
      const target = afterSignIn(from, '/p/game');
      expect(new URL(target, 'https://app.test').origin, from).toBe('https://app.test');
    }
    expect(afterSignIn('/\t/evil.example', '/p/game')).toBe('/p/game');
  });

  it('never loops back to the sign-in', () => {
    for (const from of ['/login', '/login?from=/x', '/register', '/auth/callback/google', '/api/auth/me', '/./login']) {
      expect(afterSignIn(from, '/p/game')).toBe('/p/game');
    }
  });
});

describe('return across the OAuth round trip', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('keeps ?from= of the sign-in page for the callback, once', () => {
    window.history.replaceState(null, '', '/login?from=%2Fp%2Fgame%2Fgarage');
    rememberReturn();
    window.history.replaceState(null, '', '/auth/callback/google?code=x');
    expect(afterSignIn(takeReturn(), '/p/game')).toBe('/p/game/garage');
    expect(takeReturn()).toBeNull();
  });

  it('forgets an older destination when the sign-in had none', () => {
    window.history.replaceState(null, '', '/login?from=%2Fold');
    rememberReturn();
    window.history.replaceState(null, '', '/login');
    rememberReturn();
    expect(takeReturn()).toBeNull();
  });
});

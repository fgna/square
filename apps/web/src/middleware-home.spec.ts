import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// An instance whose community.plugins.json names a start page plugin.
vi.mock('./plugins/home.generated', () => ({ HOME_PLUGIN: 'game', HOME_PATH: '/p/game' }));
const { middleware } = await import('./middleware');

const visit = (path: string, signedIn: boolean) => middleware(new NextRequest(`http://localhost:4300${path}`, {
  headers: signedIn ? { cookie: 'auth-session=1; user-role=MEMBER' } : {},
}));
const target = (response: Response) => new URL(response.headers.get('location')!).pathname + new URL(response.headers.get('location')!).search;

describe('start page plugin ("home")', () => {
  it('sends signed-in members from "/" and the sign-in pages to the start page', () => {
    for (const path of ['/', '/login', '/register']) expect(target(visit(path, true))).toBe('/p/game');
  });

  it('shows the sign-in instead of the Core landing page to visitors', () => {
    expect(target(visit('/', false))).toBe('/login');
  });

  it('still remembers the page that asked for the sign-in', () => {
    expect(target(visit('/p/game/garage', false))).toBe('/login?from=%2Fp%2Fgame%2Fgarage');
  });

  it('keeps members out of admin pages by sending them to the start page', () => {
    expect(target(visit('/admin', true))).toBe('/p/game');
  });
});

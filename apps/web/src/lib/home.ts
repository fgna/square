import { HOME_PATH } from '@/plugins/home.generated';

/**
 * Where a member goes after signing in: back to the page that asked for the
 * sign-in (the middleware passes it as ?from=), otherwise the instance's start
 * page — a plugin chosen with "home" in community.plugins.json, or the dashboard.
 */
export function afterSignIn(from: string | null | undefined, home: string = HOME_PATH): string {
  // Only paths of this app: no other origin ("//host", "/\host") and no loop back to sign-in.
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return home;
  if (/^\/(login|register|auth|api)(\/|\?|$)/.test(from)) return home;
  return from;
}

/** The ?from= of the current page, read when needed (the auth hooks run outside a Suspense boundary). */
export function currentFrom(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('from');
}

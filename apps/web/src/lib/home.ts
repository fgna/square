import { HOME_PATH } from '@/plugins/home.generated';

// Any fixed origin works: a destination is accepted only if it resolves to it.
const BASE = 'https://app.invalid';
const RETURN_KEY = 'auth_return';

/**
 * Where a member goes after signing in: back to the page that asked for the
 * sign-in (the middleware passes it as ?from=), otherwise the instance's start
 * page — a plugin chosen with "home" in community.plugins.json, or the dashboard.
 */
export function afterSignIn(from: string | null | undefined, home: string = HOME_PATH): string {
  if (!from || !from.startsWith('/')) return home;
  // Resolve like the browser will (it drops tabs and newlines, "/\" means "//"),
  // so only a path of this app survives, never another origin.
  let url: URL;
  try {
    url = new URL(from, BASE);
  } catch {
    return home;
  }
  if (url.origin !== BASE) return home;
  // No loop back to the sign-in, and nothing outside the pages.
  if (/^\/(login|register|auth|api)(\/|$)/.test(url.pathname)) return home;
  return url.pathname + url.search + url.hash;
}

/** The ?from= of the current page, read when needed (the auth hooks run outside a Suspense boundary). */
export function currentFrom(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('from');
}

/** OAuth leaves the app: keep the page to return to for the callback. */
export function rememberReturn(): void {
  const from = currentFrom();
  try {
    if (from) sessionStorage.setItem(RETURN_KEY, from);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Without storage the member lands on the start page.
  }
}

/** The page remembered before OAuth, read once. */
export function takeReturn(): string | null {
  try {
    const from = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return from;
  } catch {
    return null;
  }
}

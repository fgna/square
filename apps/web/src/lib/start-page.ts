import { afterSignIn } from './home';

/**
 * "Pick up where you left off": opening the app (its start address "/")
 * returns a signed-in member to the page they last had open, instead of the
 * start page. Both the last page and the member's choice live in cookies of
 * this browser, so the choice is per device and the middleware can read it.
 */
export const LAST_PAGE_COOKIE = 'last-page';
export const START_PAGE_COOKIE = 'start-page';

export type StartPage = 'last' | 'home';

/** Older than this, the app opens on the start page again. */
export const RESUME_WITHIN_MS = 24 * 60 * 60 * 1000;
export const LAST_PAGE_MAX_AGE = RESUME_WITHIN_MS / 1000;
export const START_PAGE_MAX_AGE = 365 * 24 * 60 * 60;

/** What an instance uses when a member chose nothing: NEXT_PUBLIC_START_PAGE=last turns resuming on. */
export function instanceStartPage(value: string | undefined = process.env.NEXT_PUBLIC_START_PAGE): StartPage {
  return value === 'last' ? 'last' : 'home';
}

/** The member's choice on this device, else the instance's. */
export function startPageChoice(cookie: string | undefined, fallback: StartPage = instanceStartPage()): StartPage {
  return cookie === 'last' || cookie === 'home' ? cookie : fallback;
}

// Pages that are no place to come back to: settings and admin are visited for
// a task, the others are entry or utility pages.
const NOT_RESUMED = /^\/(?:$|dashboard(?:[/?]|$)|settings|admin|get-app|onboarding|offline)/;

/** Only an ordinary page of this app is remembered (never another origin, sign-in or API). */
export function isResumable(path: string, home: string): boolean {
  if (!path || afterSignIn(path, '') !== path) return false;
  const pathname = path.split(/[?#]/)[0];
  if (pathname === home) return false;
  return !NOT_RESUMED.test(path);
}

export function encodeLastPage(path: string, now: number): string {
  return `${now}.${encodeURIComponent(path)}`;
}

/** The page to open instead of the start page, or null. */
export function resumeTarget(
  cookie: string | undefined,
  { choice, home, now }: { choice: StartPage; home: string; now: number },
): string | null {
  if (choice !== 'last' || !cookie) return null;
  const dot = cookie.indexOf('.');
  if (dot < 1) return null;
  const at = Number(cookie.slice(0, dot));
  if (!Number.isFinite(at) || now - at > RESUME_WITHIN_MS || at > now + 60_000) return null;
  let path: string;
  try {
    path = decodeURIComponent(cookie.slice(dot + 1));
  } catch {
    return null;
  }
  return isResumable(path, home) ? path : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; SameSite=Lax; max-age=${maxAge}`;
}

/** Called on every page change inside the app. */
export function rememberPage(path: string, home: string, now = Date.now()): void {
  if (typeof document === 'undefined' || !isResumable(path, home)) return;
  writeCookie(LAST_PAGE_COOKIE, encodeLastPage(path, now), LAST_PAGE_MAX_AGE);
}

export function forgetLastPage(): void {
  if (typeof document === 'undefined') return;
  writeCookie(LAST_PAGE_COOKIE, '', 0);
}

export function readStartPageCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.match(/(?:^|;\s*)start-page=(\w+)/)?.[1];
}

export function saveStartPage(choice: StartPage): void {
  writeCookie(START_PAGE_COOKIE, choice, START_PAGE_MAX_AGE);
}

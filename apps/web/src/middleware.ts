import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPathEnabled } from './lib/capabilities';
import { HOME_PATH, HOME_PLUGIN } from './plugins/home.generated';

const PUBLIC_PATHS = ['/', '/login', '/register', '/api/health'];
const AUTH_PATHS = ['/login', '/register'];
const ADMIN_PATHS = ['/admin'];

// Middleware runs on the Edge runtime, where `Buffer` isn't part of the
// guaranteed API surface — use Web Crypto/btoa instead so this doesn't depend
// on a Node.js polyfill being present.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

// Nonce-based CSP: each request gets a fresh nonce, so script-src never needs
// 'unsafe-inline'. 'strict-dynamic' lets Next's own nonce-carrying bootstrap
// scripts load their child chunks without listing every host. 'unsafe-eval' is
// dev-only — Next's webpack HMR/fast-refresh relies on eval() for source maps;
// production builds don't need it.
// Uploaded images (avatars, post images) are served by the API, which runs on
// its own origin — locally :3001, in production e.g. https://api.yourdomain.com.
// Without it in img-src the browser blocks every uploaded picture.
function apiOrigin(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export function buildCspHeader(nonce: string): string {
  const api = apiOrigin();
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (process.env.NODE_ENV !== 'production') {
    scriptSrc.push("'unsafe-eval'");
  }
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    // style-src keeps 'unsafe-inline': this app renders React inline `style={{...}}`
    // props pervasively for theme tokens (--theme-text, etc.), which produce actual
    // `style="..."` attributes. Nonces do not apply to style attributes (only
    // <style>/<link> tags), so there is no nonce-based alternative for this pattern.
    "style-src 'self' 'unsafe-inline'",
    // Fonts are self-hosted by next/font; nothing is loaded from Google.
    "font-src 'self'",
    `img-src 'self' data: blob: ${api} https://avatars.githubusercontent.com https://images.unsplash.com https://via.placeholder.com`,
    `connect-src 'self' ${api}`,
    // Course lessons embed videos from these hosts only (see the API's
    // courses/video-url.ts, which refuses every other link).
    // plus the API itself, whose view-only PDFs are shown in a frame.
    `frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com ${api}`,
    // View-only audio in lessons is played straight from the API.
    `media-src 'self' ${api}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = generateNonce();
  const cspHeader = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  function next(): NextResponse {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  }

  // Next.js normalizes relative middleware Location values against the internal
  // listener URL in dev mode. The public app URL is explicitly configured by
  // the isolated HTTPS launcher, so preserve that browser origin instead.
  function redirect(path: string): NextResponse {
    const publicOrigin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const response = NextResponse.redirect(new URL(path, publicOrigin));
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  }

  // Anonymous PWA resources must remain accessible without a session.
  if (pathname === '/sw.js' || pathname === '/offline.html' || pathname === '/offline.css' ||
      pathname === '/manifest.webmanifest' || pathname.startsWith('/pwa-icon/') ||
      pathname.startsWith('/apple-icon')) return next();

  if (pathname.startsWith('/api/')) {
    return next();
  }

  // The instance's start page (a plugin chosen with "home"), unless an operator switched it off.
  const home = isPathEnabled(HOME_PATH) ? HOME_PATH : '/dashboard';

  if (!isPathEnabled(pathname)) return redirect(home);

  const authToken = request.cookies.get('auth-session')?.value;
  const userRole = request.cookies.get('user-role')?.value;

  const isPublicPath = pathname === '/get-app' || PUBLIC_PATHS.some((p) =>
    p === '/' ? pathname === '/' : pathname.startsWith(p),
  );
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));

  // Authenticated users on landing or auth pages → start page
  if (authToken && (pathname === '/' || isAuthPath)) {
    return redirect(home);
  }

  // With a start page plugin, the Core's marketing landing page is not shown: sign in instead.
  if (!authToken && pathname === '/' && HOME_PLUGIN && home !== '/dashboard') {
    return redirect('/login');
  }

  // Members who signed in on this browser before go straight to the sign-in
  // form; the landing page is for newcomers.
  if (!authToken && pathname === '/' && request.cookies.get('returning-member')?.value === '1') {
    return redirect('/login');
  }

  if (!authToken && !isPublicPath) {
    return redirect(`/login?from=${encodeURIComponent(pathname)}`);
  }

  // Admin routes require ADMIN role
  if (authToken && isAdminPath && userRole !== 'ADMIN') {
    return redirect(home);
  }

  return next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

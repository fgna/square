import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { buildCspHeader, middleware } from './middleware';

function directive(csp: string, name: string): string[] {
  const found = csp.split('; ').find((d) => d.startsWith(`${name} `));
  return found ? found.split(' ').slice(1) : [];
}

describe('buildCspHeader', () => {
  const original = process.env.NEXT_PUBLIC_API_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = original;
  });

  it('allows images from the API, which serves every uploaded avatar', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

    expect(directive(buildCspHeader('n'), 'img-src')).toContain('https://api.example.com');
  });

  it('lets lessons show view-only PDFs and play audio from the API', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

    const csp = buildCspHeader('n');
    expect(directive(csp, 'frame-src')).toContain('https://api.example.com');
    expect(directive(csp, 'media-src')).toContain('https://api.example.com');
  });

  it('uses the origin even when the API URL carries a path', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/backend/';

    const csp = buildCspHeader('n');
    expect(directive(csp, 'img-src')).toContain('https://example.com');
    expect(directive(csp, 'connect-src')).toContain('https://example.com');
  });

  it('falls back to the local API when none is configured', () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    expect(directive(buildCspHeader('n'), 'img-src')).toContain('http://localhost:3001');
  });
});


describe('auth redirects behind a TLS reverse proxy', () => {
  const originalPublicUrl = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    if (originalPublicUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalPublicUrl;
  });

  it('keeps unauthenticated redirects on the configured public HTTPS origin', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://192.168.1.121:4443';
    const request = new NextRequest('http://localhost:4300/dashboard', {
      headers: { host: '192.168.1.121:4443', 'x-forwarded-proto': 'https' },
    });
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://192.168.1.121:4443/login?from=%2Fdashboard');
  });

  it('does not send authenticated users from LAN HTTPS to localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://192.168.1.121:4443';
    const request = new NextRequest('http://localhost:4300/login', {
      headers: { cookie: 'auth-session=1', host: '192.168.1.121:4443', 'x-forwarded-proto': 'https' },
    });
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://192.168.1.121:4443/dashboard');
  });
});

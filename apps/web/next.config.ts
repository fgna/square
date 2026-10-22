import type { NextConfig } from 'next';
import path from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // The round "N" badge in the bottom-left corner (Route, Try Turbopack,
  // Preferences) is Next.js's developer overlay. It never appears in
  // production, but testers took it for part of the app.
  devIndicators: false,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@community/shared', '@community/themes', '@community/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/api/:path*`,
        },
        // Uploaded pictures are stored as "/uploads/…" paths and served by the
        // API. Loading them through the web app's own address keeps them
        // working whatever domain the platform runs on.
        {
          source: '/uploads/:path*',
          destination: `${apiUrl}/uploads/:path*`,
        },
      ],
      fallback: [],
    };
  },
  async headers() {
    // Content-Security-Policy is set per-request in src/middleware.ts (it needs a
    // fresh nonce every request); everything else static stays here.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

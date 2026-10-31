import type { MetadataRoute } from 'next';
import { getServerBranding } from '@/lib/server-branding';

// Name and icon come from Admin → Settings, so read them per request.
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { platformName } = await getServerBranding();
  return {
    id: '/',
    name: platformName,
    short_name: platformName,
    description: 'Community discussions, courses and events',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#090d16',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

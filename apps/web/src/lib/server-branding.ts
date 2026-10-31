/**
 * Name and app icon from Admin → Settings, read on the server for things the
 * browser asks for before any page script runs: the web app manifest, the
 * home-screen icons and the browser tab title. Falls back to the neutral
 * defaults when the API cannot be reached (e.g. during the image build).
 */
export interface ServerBranding {
  platformName: string;
  appIconUrl: string | null;
}

export const DEFAULT_BRANDING: ServerBranding = { platformName: 'Community Platform', appIconUrl: null };

/** The API as the web server reaches it (inside Docker: the internal address). */
export function apiOrigin(): string {
  return (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
}

export async function getServerBranding(): Promise<ServerBranding> {
  try {
    const res = await fetch(`${apiOrigin()}/api/platform/branding`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return DEFAULT_BRANDING;
    const data = (await res.json()) as Partial<ServerBranding>;
    const platformName = typeof data.platformName === 'string' && data.platformName.trim() ? data.platformName.trim() : DEFAULT_BRANDING.platformName;
    const appIconUrl = typeof data.appIconUrl === 'string' && data.appIconUrl.startsWith('/uploads/') ? data.appIconUrl : null;
    return { platformName, appIconUrl };
  } catch {
    return DEFAULT_BRANDING;
  }
}

/** First letter of the name for the generated icon ("GrowthLeaders" → "G"). */
export function iconLetter(platformName: string): string {
  return Array.from(platformName.trim())[0]?.toUpperCase() || 'C';
}

/**
 * Name and app icon from Admin → Settings, read on the server for things the
 * browser asks for before any page script runs: the web app manifest, the
 * home-screen icons and the browser tab title. Falls back to the neutral
 * defaults when the API cannot be reached (e.g. during the image build).
 */
export interface ServerBranding {
  platformName: string;
  appIconUrl: string | null;
  allowSignups: boolean;
  /** Page for visitors without an invitation (https), from Admin → Settings. */
  joinUrl: string | null;
}

export const DEFAULT_BRANDING: ServerBranding = { platformName: 'Community Platform', appIconUrl: null, allowSignups: true, joinUrl: null };

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
    const allowSignups = data.allowSignups !== false;
    const joinUrl = typeof data.joinUrl === 'string' && data.joinUrl.startsWith('https://') ? data.joinUrl : null;
    return { platformName, appIconUrl, allowSignups, joinUrl };
  } catch {
    return DEFAULT_BRANDING;
  }
}

/** First letter of the name for the generated icon ("GrowthLeaders" → "G"). */
export function iconLetter(platformName: string): string {
  return Array.from(platformName.trim())[0]?.toUpperCase() || 'C';
}

/**
 * Where "join" and "register" lead: the sign-up form, or – while sign-ups need
 * an invitation – the page set for visitors without one, if any.
 */
export function joinHref(branding: Pick<ServerBranding, 'allowSignups' | 'joinUrl'>): string {
  return !branding.allowSignups && branding.joinUrl ? branding.joinUrl : '/register';
}

import { ImageResponse } from 'next/og';
import { apiOrigin, getServerBranding, iconLetter } from './server-branding';

const MAX_ICON_BYTES = 5 * 1024 * 1024;

/** The uploaded app icon as a data URL, or null (missing, too large, not an image). */
async function uploadedIcon(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiOrigin()}${path}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    const type = res.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!res.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_ICON_BYTES) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * A square PNG for the home screen or browser: the icon uploaded in
 * Admin → Settings, scaled to `size`, or else the first letter of the
 * platform name. `rounded` for the manifest icons (Apple rounds its own).
 */
export async function renderAppIcon(size: number, { rounded }: { rounded: boolean }) {
  const branding = await getServerBranding();
  const image = branding.appIconUrl ? await uploadedIcon(branding.appIconUrl) : null;
  return new ImageResponse(
    image ? (
      // Rendered to PNG on the server, so a plain <img> is right here.
      <img src={image} width={size} height={size} alt="" style={{ objectFit: 'cover' }} />
    ) : (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#090d16',
          color: '#c5a880',
          fontSize: Math.round(size * 0.49),
          fontWeight: 700,
          fontFamily: 'sans-serif',
          borderRadius: rounded ? size * 0.18 : 0,
        }}
      >
        {iconLetter(branding.platformName)}
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}

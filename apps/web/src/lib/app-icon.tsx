import { ImageResponse } from 'next/og';
import { apiOrigin, getServerBranding, iconLetter } from './server-branding';

const MAX_ICON_BYTES = 5 * 1024 * 1024;

/**
 * Reads a response body up to `limit` bytes; null if it is (or announces to
 * be) larger, so a huge upload never ends up in the web server's memory.
 */
export async function readLimited(res: Response, limit: number): Promise<Buffer | null> {
  const announced = Number(res.headers.get('content-length'));
  if (Number.isFinite(announced) && announced > limit) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** The uploaded app icon as a data URL, or null (missing, too large, not an image). */
async function uploadedIcon(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiOrigin()}${path}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    const type = res.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!res.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type)) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const bytes = await readLimited(res, MAX_ICON_BYTES);
    return bytes ? `data:${type};base64,${bytes.toString('base64')}` : null;
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

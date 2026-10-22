/**
 * Lessons link to videos hosted elsewhere. Only these hosts are accepted,
 * because each one is embedded in an iframe and has to be allowed by the web
 * app's frame-src policy. A self-hosted upload would be added as another
 * source here, not by loosening this list.
 */
export type VideoProvider = 'youtube' | 'vimeo' | 'loom';

export interface VideoEmbed {
  provider: VideoProvider;
  embedUrl: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function toVideoEmbed(input: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
    if (!id || !YOUTUBE_ID.test(id)) return null;
    // The no-cookie domain sets no tracking cookies until the video is played.
    return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123, vimeo.com/123/abcdef (unlisted hash), player.vimeo.com/video/123?h=abcdef
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([A-Za-z0-9]+))?/);
    if (!match) return null;
    const hash = match[2] ?? url.searchParams.get('h');
    const query = hash ? `?h=${encodeURIComponent(hash)}` : '';
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${match[1]}${query}` };
  }

  if (host === 'loom.com') {
    const match = url.pathname.match(/^\/(?:share|embed)\/([A-Za-z0-9]+)/);
    if (!match) return null;
    return { provider: 'loom', embedUrl: `https://www.loom.com/embed/${match[1]}` };
  }

  return null;
}

/**
 * The page where a member can download the video, if its owner allows that
 * there. Vimeo and Loom offer downloads on their share pages (Vimeo on paid
 * plans); YouTube offers none, so it gets no link.
 */
export function videoDownloadPage(input: string): string | null {
  const embed = toVideoEmbed(input);
  if (!embed) return null;
  if (embed.provider === 'vimeo') {
    const match = embed.embedUrl.match(/\/video\/(\d+)(?:\?h=([A-Za-z0-9]+))?/);
    return match ? `https://vimeo.com/${match[1]}${match[2] ? `/${match[2]}` : ''}` : null;
  }
  if (embed.provider === 'loom') {
    return embed.embedUrl.replace('/embed/', '/share/');
  }
  return null;
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { PRIVACY_URL } from '@/lib/legal';

function providerName(host: string): string {
  if (host.includes('youtube')) return 'YouTube';
  if (host.includes('vimeo')) return 'Vimeo';
  if (host.includes('loom')) return 'Loom';
  return host;
}

/**
 * The player of an external video host loads only after a click. Until then
 * the browser makes no connection to YouTube, Vimeo or Loom, which would
 * otherwise learn the member's IP address as soon as the page opens. Vimeo
 * gets "do not track"; after the click the video starts right away.
 */
export function ClickToLoadVideo({ embedUrl, title }: { embedUrl: string; title: string }) {
  const t = useTranslations('video');
  const [loaded, setLoaded] = useState(false);

  let url: URL | null = null;
  try {
    url = new URL(embedUrl);
  } catch {
    url = null;
  }
  const provider = url ? providerName(url.hostname) : '';
  if (url) {
    if (url.hostname.includes('vimeo')) url.searchParams.set('dnt', '1');
    url.searchParams.set('autoplay', '1');
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9', background: '#000' }}>
      {loaded && url ? (
        <iframe
          src={url.toString()}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
            style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
          >
            <Play size={16} />
            {t('load')}
          </button>
          <p className="text-xs max-w-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {t('notice', { provider })}{' '}
            {PRIVACY_URL && (
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline">
                {t('privacy')}
              </a>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

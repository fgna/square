'use client';

import { useTranslations } from 'next-intl';
import { PlayCircle, X } from 'lucide-react';
import { useDismissWelcomeVideo, useWelcomeVideo } from '@/hooks/use-welcome-video';
import { ClickToLoadVideo } from '@/components/common/click-to-load-video';

export function WelcomeVideoPlayer({ embedUrl }: { embedUrl: string }) {
  const t = useTranslations('dashboard');
  return (
    <ClickToLoadVideo embedUrl={embedUrl} title={t('welcome.video')} />
  );
}

/**
 * The welcome video on the dashboard, for members who have not hidden it.
 * Renders nothing when no video is set.
 */
export function WelcomeVideoCard() {
  const t = useTranslations('dashboard');
  const { data } = useWelcomeVideo();
  const dismiss = useDismissWelcomeVideo();

  if (!data?.videoEmbedUrl || data.dismissed) return null;

  return (
    <section
      aria-label={t('welcome.video')}
      className="rounded-xl p-5 space-y-3"
      style={{ background: 'var(--theme-card)', border: '1px solid rgba(197,168,128,0.35)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
          <PlayCircle size={18} style={{ color: 'var(--theme-primary)' }} /> {t('welcome.heading')}
        </h3>
        <button
          type="button"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          className="flex items-center gap-1 text-xs rounded px-2 py-1 hover:bg-white/5"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <X size={13} /> {t('welcome.hide')}
        </button>
      </div>
      <WelcomeVideoPlayer embedUrl={data.videoEmbedUrl} />
    </section>
  );
}

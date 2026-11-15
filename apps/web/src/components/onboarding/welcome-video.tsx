'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlayCircle, X } from 'lucide-react';
import { useDismissWelcomeVideo, useWelcomeVideo } from '@/hooks/use-welcome-video';
import { ClickToLoadVideo } from '@/components/common/click-to-load-video';
import { HostedVideo } from '@/components/common/hosted-video';

export function WelcomeVideoPlayer({ embedUrl, fileUrl }: { embedUrl?: string | null; fileUrl?: string | null }) {
  const t = useTranslations('dashboard');
  // An uploaded video plays directly; external hosts load only after a click.
  if (fileUrl) return <HostedVideo src={fileUrl} title={t('welcome.video')} />;
  if (!embedUrl) return null;
  return <ClickToLoadVideo embedUrl={embedUrl} title={t('welcome.video')} />;
}

/**
 * The welcome video on the dashboard. Hiding it folds it into a single line
 * from which the member can open it again: hiding is remembered, but the video
 * stays findable. Renders nothing when no video is set.
 */
export function WelcomeVideoCard() {
  const t = useTranslations('dashboard');
  const { data } = useWelcomeVideo();
  const dismiss = useDismissWelcomeVideo();
  // Opened again after it was hidden: only for this visit, the next one shows the line again.
  const [reopened, setReopened] = useState(false);

  if (!(data?.videoEmbedUrl || data?.videoFileUrl)) return null;

  if (data.dismissed && !reopened) {
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 hover:bg-white/5"
        style={{ color: 'var(--theme-text-muted)', border: '1px solid var(--theme-border)' }}
      >
        <PlayCircle size={16} style={{ color: 'var(--theme-primary)' }} /> {t('welcome.watchAgain')}
      </button>
    );
  }

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
          onClick={() => (data.dismissed ? setReopened(false) : dismiss.mutate())}
          disabled={dismiss.isPending}
          className="flex items-center gap-1 text-xs rounded px-2 py-1 hover:bg-white/5"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <X size={13} /> {t('welcome.hide')}
        </button>
      </div>
      <WelcomeVideoPlayer embedUrl={data.videoEmbedUrl} fileUrl={data.videoFileUrl} />
    </section>
  );
}

/**
 * Admin → Settings: the welcome video as members get it, so admins can check
 * it even after hiding it on their own dashboard. Shows the saved setting.
 */
export function WelcomeVideoPreview() {
  const t = useTranslations('adminSettingsUI');
  const { data } = useWelcomeVideo();
  if (!(data?.videoEmbedUrl || data?.videoFileUrl)) return null;
  return (
    <div className="space-y-1.5 pt-2">
      <p className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
        {t('welcomeVideoPreview')}
      </p>
      <WelcomeVideoPlayer embedUrl={data.videoEmbedUrl} fileUrl={data.videoFileUrl} />
    </div>
  );
}

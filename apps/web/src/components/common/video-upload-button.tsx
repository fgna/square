'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { uploadVideo } from '@/lib/upload-video';

/**
 * Admins upload an MP4 or MOV (H.264) to the platform instead of linking a video host. On
 * success the caller receives the video's path for the lesson or recording.
 */
export function VideoUploadButton({ onUploaded }: { onUploaded: (url: string, filename: string) => void }) {
  const t = useTranslations('videoUpload');
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (file: File) => {
    setError(null);
    if (!/\.(mp4|m4v|mov)$/i.test(file.name)) {
      setError(t('onlyMp4'));
      return;
    }
    abort.current = new AbortController();
    setProgress(0);
    try {
      const done = await uploadVideo(apiClient, file, setProgress, abort.current.signal);
      onUploaded(done.url, done.filename);
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
        setError(err?.response?.data?.message ?? t('failed'));
      }
    } finally {
      setProgress(null);
      abort.current = null;
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.m4v,.mov"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && start(e.target.files[0])}
      />
      {progress === null ? (
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <Upload size={14} className="mr-1.5" /> {t('button')}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--theme-border)' }}>
            <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--theme-primary)' }} />
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'var(--theme-text-muted)' }}>
            {t('progress', { percent: Math.round(progress * 100) })}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => abort.current?.abort()} aria-label={t('cancel')}>
            <X size={14} />
          </Button>
        </div>
      )}
      <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('hint')}</p>
      {error && <p className="text-xs" style={{ color: 'var(--theme-error, #dc2626)' }} role="alert">{error}</p>}
    </div>
  );
}

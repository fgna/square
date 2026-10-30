'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Music, X, Video, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { VideoUploadButton } from '@/components/common/video-upload-button';

/** An attachment chosen in the composer, sent to POST /posts/:id/attachments after the post exists. */
export type PendingAttachment = { label: string; uploadId?: string; videoUrl?: string };

/**
 * Admins attach audio (e.g. a weekly audio message) or an uploaded video to
 * a new post. Files are uploaded right away; the post links them once it is
 * created.
 */
export function PostAttachmentsPicker({
  value,
  onChange,
}: {
  value: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
}) {
  const t = useTranslations('feed.attachments');
  const audioInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAudio = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post('/uploads/file', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange([...value, { label: file.name, uploadId: data.id }]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('failed'));
    } finally {
      setUploading(false);
      if (audioInput.current) audioInput.current.value = '';
    }
  };

  return (
    <div className="space-y-2 rounded-lg p-3" style={{ border: '1px dashed var(--theme-border)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>{t('title')}</p>
      {value.map((a, i) => (
        <div key={`${a.label}-${i}`} className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text)' }}>
          {a.videoUrl ? <Video size={14} /> : <Music size={14} />}
          <span className="flex-1 truncate">{a.label}</span>
          <button type="button" aria-label={t('remove')} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-start gap-2">
        <input
          ref={audioInput}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => audioInput.current?.click()}>
          {uploading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Music size={14} className="mr-1.5" />}
          {t('audio')}
        </Button>
        <VideoUploadButton onUploaded={(url, filename) => onChange([...value, { label: filename, videoUrl: url }])} />
      </div>
      {error && <p className="text-xs" role="alert" style={{ color: 'var(--theme-danger, #ef4444)' }}>{error}</p>}
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Download, ExternalLink, FileText, Lock, Music } from 'lucide-react';
import { renderPostContent } from '@/lib/render-post-content';
import { useFormatters } from '@/lib/use-formatters';
import { ClickToLoadVideo } from '@/components/common/click-to-load-video';
import { HostedVideo } from '@/components/common/hosted-video';
import type { Lesson, LessonAttachment } from '@community/shared';

/** PDF and audio can be shown in the lesson; Office files only open once downloaded. */
export function isViewableInBrowser(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('audio/');
}

/**
 * A file the admin made view-only: shown in place, without a download link.
 * This discourages downloading but cannot prevent it — whatever a browser
 * displays, it can also save.
 */
function ViewOnlyFile({ file }: { file: LessonAttachment }) {
  if (file.mimeType.startsWith('audio/')) {
    return (
      <figure className="space-y-1.5">
        <figcaption className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text)' }}>
          <Music size={16} style={{ color: 'var(--theme-primary)' }} /> {file.filename}
        </figcaption>
        <audio
          controls
          controlsList="nodownload"
          preload="none"
          src={file.url}
          className="w-full"
          onContextMenu={(e) => e.preventDefault()}
        />
      </figure>
    );
  }
  return (
    <figure className="space-y-1.5">
      <figcaption className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text)' }}>
        <FileText size={16} style={{ color: 'var(--theme-primary)' }} /> {file.filename}
      </figcaption>
      {/* #toolbar=0 hides the viewer's toolbar, download button included, in
          Chromium-based browsers; Firefox's viewer ignores it. */}
      <iframe
        src={`${file.url}#toolbar=0&navpanes=0`}
        title={file.filename}
        className="w-full rounded-lg"
        style={{ height: '70vh', border: '1px solid var(--theme-border)', background: '#fff' }}
      />
    </figure>
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One lesson as a member sees it: the video, the text under it, and the
 * files to download. A drip lesson that has not opened yet arrives from the
 * API without any of these, so all there is to show is when it opens.
 */
export function LessonView({ lesson }: { lesson: Lesson }) {
  const t = useTranslations('courses');
  const { dateFnsLocale } = useFormatters();
  if (lesson.locked) {
    return (
      <div
        className="rounded-lg p-8 flex flex-col items-center text-center gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--theme-border)' }}
      >
        <Lock size={24} style={{ color: 'var(--theme-primary)' }} />
        <p className="font-medium" style={{ color: 'var(--theme-text)' }}>
          {lesson.availableAt
            ? t('lesson.opensOn', { date: format(new Date(lesson.availableAt), t('lesson.dateFormat'), { locale: dateFnsLocale }) })
            : t('lesson.opensSoon')}
        </p>
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {t('lesson.dripHint')}
        </p>
      </div>
    );
  }

  const text = lesson.content?.trim() ? renderPostContent(lesson.content) : null;
  const all = lesson.attachments ?? [];
  const files = all.filter((f) => f.downloadable !== false);
  const viewOnly = all.filter((f) => f.downloadable === false && isViewableInBrowser(f.mimeType));
  // Audio (a guided meditation) plays in the lesson; downloading stays possible.
  const players = files.filter((f) => f.mimeType.startsWith('audio/'));

  return (
    <div className="space-y-5">
      {lesson.videoFileUrl && <HostedVideo src={lesson.videoFileUrl} title={lesson.title} />}
      {lesson.videoEmbedUrl && (
        <ClickToLoadVideo embedUrl={lesson.videoEmbedUrl} title={lesson.title} />
      )}

      {lesson.videoDownloadUrl && (
        <a
          href={lesson.videoDownloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: 'var(--theme-primary)' }}
        >
          <Download size={14} /> {t('lesson.downloadVideo')} <ExternalLink size={12} />
        </a>
      )}

      {text && (
        <div
          className={`text-sm leading-relaxed ${text.className}`}
          style={{ color: 'var(--theme-text)' }}
          dangerouslySetInnerHTML={{ __html: text.html }}
        />
      )}

      {viewOnly.length > 0 && (
        <div className="space-y-4">
          {viewOnly.map((file) => (
            <ViewOnlyFile key={file.id} file={file} />
          ))}
        </div>
      )}

      {players.length > 0 && (
        <div className="space-y-4">
          {players.map((file) => (
            <figure key={file.id} className="space-y-1.5">
              <figcaption className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text)' }}>
                <Music size={16} style={{ color: 'var(--theme-primary)' }} /> {file.filename}
              </figcaption>
              <audio controls preload="none" src={file.url} className="w-full" />
            </figure>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
            {t('lesson.downloads')}
          </h3>
          <ul className="space-y-1.5">
            {files.map((file) => (
              <li key={file.id}>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={file.filename}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
                  style={{ border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}
                >
                  <FileText size={16} style={{ color: 'var(--theme-primary)' }} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{file.filename}</span>
                  <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {formatFileSize(file.size)}
                  </span>
                  <Download size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

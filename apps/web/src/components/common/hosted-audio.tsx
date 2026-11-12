'use client';

import { useRef } from 'react';
import { usePersistentMedia } from '@/hooks/use-persistent-media';

/**
 * Audio uploaded to the platform (a weekly message, a lesson recording).
 * Keeps playing in the mini player when the member opens another page and
 * continues where they stopped. No download button unless the file is meant
 * to be downloaded (a lesson file the admin did not make view-only).
 */
export function HostedAudio({
  src,
  title,
  downloadable = false,
  backHref,
}: {
  src: string;
  title: string;
  downloadable?: boolean;
  /** The page the mini player leads back to, e.g. the post itself rather than the whole forum. */
  backHref?: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const playSrc = usePersistentMedia(ref, src, title, backHref);
  return (
    <audio
      ref={ref}
      src={playSrc}
      title={title}
      controls
      preload="none"
      controlsList={downloadable ? undefined : 'nodownload'}
      onContextMenu={downloadable ? undefined : (e) => e.preventDefault()}
      className="w-full"
    />
  );
}

'use client';

import { useRef } from 'react';
import { usePersistentMedia } from '@/hooks/use-persistent-media';

/**
 * A video uploaded to the platform itself. The link is signed and expires,
 * so it does not work outside the platform; no third party is involved.
 * No download button and no context menu ("Save video as…"): videos are for
 * watching here. This does not stop a determined viewer, it only avoids
 * inviting downloads.
 * Leaving the page while it plays continues its sound in the mini player;
 * coming back shows the picture again at the same moment.
 */
export function HostedVideo({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const playSrc = usePersistentMedia(ref, src, title);
  return (
    <div className="w-full overflow-hidden rounded-lg" style={{ background: '#000' }}>
      <video
        ref={ref}
        src={playSrc}
        title={title}
        controls
        preload="metadata"
        playsInline
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full"
        style={{ aspectRatio: '16 / 9' }}
      />
    </div>
  );
}

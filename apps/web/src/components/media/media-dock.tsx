'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Music, Pause, Play, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { claimPlayback, releasePlayback, useMediaStore } from '@/store/media.store';
import { clearPosition, writePosition } from '@/lib/media-position';
import { setMediaSessionState, showInMediaSession } from '@/lib/media-session';

// A hand-over this old was not a page change (e.g. the member went to the
// admin area and came back much later): show it, but do not start playing.
const AUTOPLAY_WINDOW_MS = 10_000;
const SAVE_EVERY_MS = 5000;

/**
 * The mini player at the bottom of the screen. It takes over audio or video
 * that was playing when the member opened another page, so a weekly message
 * keeps playing while they write in their journal. Video continues as sound;
 * the title leads back to the page, where the picture picks up at the same
 * moment.
 */
export function MediaDock() {
  const t = useTranslations('mediaPlayer');
  const docked = useMediaStore((s) => s.docked);
  const position = useMediaStore((s) => s.dockPosition);
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !docked) return;
    const userId = useAuthStore.getState().user?.id ?? 'guest';
    const { key, title, position: startAt } = docked;
    let lastSaved = 0;
    const save = () => {
      lastSaved = Date.now();
      writePosition(userId, key, el.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(el.duration);
      if (startAt > 0) el.currentTime = startAt;
    };
    const onPlay = () => {
      claimPlayback(el);
      setPlaying(true);
      showInMediaSession(el, title, document.title);
      setMediaSessionState(true);
    };
    const onPause = () => {
      setPlaying(false);
      setMediaSessionState(false);
      if (!el.ended) save();
    };
    const onTimeUpdate = () => {
      useMediaStore.getState().setDockPosition(el.currentTime);
      if (Date.now() - lastSaved >= SAVE_EVERY_MS) save();
    };
    const onEnded = () => {
      clearPosition(userId, key);
      useMediaStore.getState().closeDock();
    };

    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    el.src = docked.src;
    if (Date.now() - docked.dockedAt < AUTOPLAY_WINDOW_MS) void el.play().catch(() => setPlaying(false));
    else el.load();

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      if (el.currentTime > 0 && !el.ended) save();
      el.pause();
      el.removeAttribute('src');
      el.load();
      releasePlayback(el);
      setPlaying(false);
      setDuration(0);
    };
  }, [docked]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };

  return (
    <>
      {/* Always in the page, so the browser keeps it across page changes. */}
      <audio ref={ref} preload="none" className="hidden" />
      {docked && (
        <>
          {/* Keeps the end of the page from hiding behind the player. */}
          <div aria-hidden className="h-16" />
          <div
            role="region"
            aria-label={t('label')}
            className="fixed bottom-0 left-0 right-0 z-[20] lg:left-[280px]"
            // Matches the top bar.
            style={{
              background: 'rgba(9,13,22,0.8)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid var(--theme-border)',
            }}
          >
            <div
              className="h-0.5"
              style={{
                background: 'var(--theme-primary)',
                width: duration > 0 ? `${Math.min(100, (position / duration) * 100)}%` : '0%',
              }}
            />
            <div className="flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? t('pause') : t('play')}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <Link
                href={docked.href}
                className="flex min-w-0 flex-1 items-center gap-2 text-sm"
                style={{ color: 'var(--theme-text)' }}
                title={t('open')}
              >
                <Music size={14} className="flex-shrink-0" style={{ color: 'var(--theme-primary)' }} />
                <span className="truncate">{docked.title}</span>
              </Link>
              <button
                type="button"
                onClick={() => useMediaStore.getState().closeDock()}
                aria-label={t('close')}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full hover:bg-white/5"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

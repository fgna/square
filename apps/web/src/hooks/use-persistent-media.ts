import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { claimPlayback, releasePlayback, useMediaStore } from '@/store/media.store';
import { clearPosition, mediaKey, readPosition, resumeAt, writePosition } from '@/lib/media-position';
import { setMediaSessionState, showInMediaSession } from '@/lib/media-session';

// Saving on every timeupdate (4× a second) would be wasteful; a few seconds lost is fine.
const SAVE_EVERY_MS = 5000;

/**
 * Makes an <audio> or <video> on a page survive the member doing something else:
 * - it continues where the member stopped last time (per member, this browser);
 * - leaving the page while it plays hands it to the mini player, which keeps
 *   it going; coming back hands it back at the current position;
 * - only one thing plays at a time;
 * - title and play/pause show on the lock screen where the browser supports it.
 * Switching apps or locking the screen keeps playing wherever the browser and
 * the operating system allow background playback.
 *
 * Returns the link to put on the element. Uploaded media links are signed
 * with an expiry, so every refetch (e.g. on returning to the tab) brings a new
 * one; a new src would make the browser reload the file and start over. The
 * first link is kept for as long as it is the same file (links last 24 h).
 */
export function usePersistentMedia(ref: RefObject<HTMLMediaElement | null>, src: string, title: string): string {
  const stable = useRef(src);
  if (mediaKey(stable.current) !== mediaKey(src)) stable.current = src;
  const playSrc = stable.current;

  // A layout effect, so the clean-up still sees the element playing: once React
  // removes it from the page, the browser pauses it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !playSrc) return;
    const key = mediaKey(playSrc);
    const userId = useAuthStore.getState().user?.id ?? 'guest';
    const href = `${window.location.pathname}${window.location.search}`;

    const fromDock = useMediaStore.getState().undock(key);
    let pendingSeek: number | null = fromDock ?? readPosition(userId, key);
    let lastSaved = 0;

    const seekIfPending = () => {
      if (pendingSeek === null) return;
      const at = fromDock !== null ? pendingSeek : resumeAt(pendingSeek, el.duration);
      pendingSeek = null;
      if (at !== null && at > 0) el.currentTime = at;
    };
    // Until the file is loaded, currentTime is 0: the position to go to is the real one.
    const position = () => (pendingSeek !== null ? pendingSeek : el.currentTime);
    const save = () => {
      lastSaved = Date.now();
      if (pendingSeek === null) writePosition(userId, key, el.currentTime);
    };

    const onLoadedMetadata = () => seekIfPending();
    const onPlay = () => {
      claimPlayback(el);
      showInMediaSession(el, title, document.title);
      setMediaSessionState(true);
    };
    const onPause = () => {
      setMediaSessionState(false);
      if (!el.ended) save();
    };
    const onTimeUpdate = () => {
      if (Date.now() - lastSaved >= SAVE_EVERY_MS) save();
    };
    const onEnded = () => clearPosition(userId, key);

    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);

    if (el.readyState >= 1) seekIfPending();
    // It was playing in the mini player a moment ago: carry on here.
    if (fromDock !== null) void el.play().catch(() => undefined);

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      releasePlayback(el);
      if (el.currentTime > 0 && !el.ended) save();
      if (!el.paused && !el.ended) {
        useMediaStore.getState().dock({ key, src: playSrc, title, href }, position());
        el.pause();
      }
    };
  }, [ref, playSrc, title]);

  return playSrc;
}

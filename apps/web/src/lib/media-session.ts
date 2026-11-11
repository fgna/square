/**
 * Title and play/pause on the lock screen, in the notification shade and on
 * headphone buttons, where the browser supports the Media Session API.
 */
export function showInMediaSession(el: HTMLMediaElement, title: string, artist: string): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  try {
    session.metadata = new MediaMetadata({
      title,
      artist,
      artwork: [
        { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png' },
      ],
    });
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => void el.play().catch(() => undefined)],
      ['pause', () => el.pause()],
      ['seekbackward', (d) => (el.currentTime = Math.max(0, el.currentTime - (d.seekOffset ?? 15)))],
      ['seekforward', (d) => (el.currentTime = el.currentTime + (d.seekOffset ?? 15))],
    ];
    for (const [action, handler] of actions) session.setActionHandler(action, handler);
  } catch {
    // Older browsers know the API but not every action; playback is unaffected.
  }
}

export function setMediaSessionState(playing: boolean): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

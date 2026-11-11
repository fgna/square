import { create } from 'zustand';

export interface MediaItem {
  /** Stable per file, see mediaKey(). */
  key: string;
  /** Signed link the player loads. */
  src: string;
  title: string;
  /** The page the media belongs to, to go back to it from the mini player. */
  href: string;
}

export interface DockedMedia extends MediaItem {
  position: number;
  /** When it was handed over; a stale hand-over does not start playing by itself. */
  dockedAt: number;
}

interface MediaStore {
  docked: DockedMedia | null;
  /** Current time of the docked media, kept up to date by the mini player. */
  dockPosition: number;
  /** A page with a playing player is left: the mini player continues it. */
  dock: (item: MediaItem, position: number) => void;
  /**
   * The page of the docked media is open again: its own player takes over.
   * Returns where the mini player was, or null if it held something else.
   */
  undock: (key: string) => number | null;
  setDockPosition: (seconds: number) => void;
  closeDock: () => void;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  docked: null,
  dockPosition: 0,
  dock: (item, position) =>
    set({ docked: { ...item, position, dockedAt: Date.now() }, dockPosition: position }),
  undock: (key) => {
    const { docked, dockPosition } = get();
    if (!docked || docked.key !== key) return null;
    set({ docked: null, dockPosition: 0 });
    return dockPosition;
  },
  setDockPosition: (seconds) => set({ dockPosition: seconds }),
  closeDock: () => set({ docked: null, dockPosition: 0 }),
}));

// Only one thing plays at a time. A media element is not state to render, so
// it is kept outside the store.
let current: HTMLMediaElement | null = null;

/** Called when an element starts playing: pauses whatever played before. */
export function claimPlayback(el: HTMLMediaElement): void {
  if (current && current !== el && !current.paused) current.pause();
  current = el;
}

export function releasePlayback(el: HTMLMediaElement): void {
  if (current === el) current = null;
}

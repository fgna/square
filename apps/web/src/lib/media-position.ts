/**
 * Where a member stopped in an audio or video, so it continues there on the
 * next visit. Kept in this browser only (per member), like a bookmark: no
 * server round trip, nothing to clean up when a file is deleted.
 */

const STORAGE_PREFIX = 'square:media-positions:';
// Enough for every recent message or lesson; the oldest entries drop out.
const MAX_ENTRIES = 100;
// Closer than this to the start or the end, starting over is what members expect.
const EDGE_SECONDS = 5;

type Positions = Record<string, { t: number; at: number }>;

/**
 * The same file always gets the same key. Uploaded media links carry an
 * expiring signature (?exp=…&sig=…), so the query is dropped.
 */
export function mediaKey(src: string): string {
  return src.split(/[?#]/)[0];
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function load(userId: string): Positions {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Positions) : {};
  } catch {
    return {};
  }
}

function store(userId: string, positions: Positions): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(positions));
  } catch {
    // Private mode or a full storage: playback still works, only without resume.
  }
}

export function readPosition(userId: string, key: string): number | null {
  const entry = load(userId)[key];
  return entry && Number.isFinite(entry.t) ? entry.t : null;
}

export function writePosition(userId: string, key: string, seconds: number, now = Date.now()): void {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  const positions = load(userId);
  positions[key] = { t: Math.floor(seconds), at: now };
  const keys = Object.keys(positions);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => positions[a].at - positions[b].at)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete positions[k]);
  }
  store(userId, positions);
}

export function clearPosition(userId: string, key: string): void {
  const positions = load(userId);
  if (!(key in positions)) return;
  delete positions[key];
  store(userId, positions);
}

/** The time to continue from, or null to start at the beginning. */
export function resumeAt(saved: number | null, duration: number): number | null {
  if (saved === null || saved < EDGE_SECONDS) return null;
  if (Number.isFinite(duration) && duration > 0 && saved > duration - EDGE_SECONDS) return null;
  return saved;
}

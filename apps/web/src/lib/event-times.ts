const HOUR = 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** A Date as the value of <input type="datetime-local"> (local time, minutes). */
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The next full hour from `now`, lasting one hour. */
export function defaultEventTimes(now: Date = new Date()): { startsAt: string; endsAt: string } {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return { startsAt: toLocalInput(start), endsAt: toLocalInput(new Date(start.getTime() + HOUR)) };
}

/**
 * The end time after the start moved from `prevStart` to `nextStart`: it keeps
 * the event's duration, or becomes start + 1 hour if there was no end yet.
 */
export function followEnd(prevStart: string, nextStart: string, end: string): string {
  const next = new Date(nextStart);
  if (Number.isNaN(next.getTime())) return end;
  const prev = new Date(prevStart);
  const oldEnd = new Date(end);
  const duration =
    !end || Number.isNaN(oldEnd.getTime()) || Number.isNaN(prev.getTime()) || oldEnd <= prev
      ? HOUR
      : oldEnd.getTime() - prev.getTime();
  return toLocalInput(new Date(next.getTime() + duration));
}

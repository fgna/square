/** A proposed date: "start" or "start/end" (ISO 8601 interval, as stored by the API). */
export function splitProposedDate(value: string): { start: string; end?: string } {
  const [start, end] = value.split('/');
  return { start, end: end || undefined };
}

/** "Do., 5. Nov., 18:00–19:30" in the viewer's language. */
export function formatProposedDate(value: string, locale: string): string {
  const { start, end } = splitProposedDate(value);
  const tag = locale === 'de' ? 'de-DE' : 'en-US';
  const from = new Date(start).toLocaleDateString(tag, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (!end) return from;
  const to = new Date(end).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
  return `${from}–${to}`;
}

/** Form row (datetime-local start, time-of-day end) to the stored value. */
export function joinProposedDate(start: string, endTime: string): string {
  if (!start) return '';
  return endTime ? `${start}/${start.slice(0, 10)}T${endTime}` : start;
}

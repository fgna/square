/**
 * Dates, times and small wording helpers for e-mails.
 *
 * Mails are German for now (the platform's default language; members' own
 * language is not stored yet). Times are formatted in the platform's time
 * zone, never the server's: in a container the clock runs on UTC, so a
 * 19:30 event used to be announced as 17:30 in summer.
 */
export const MAIL_TIME_ZONE = process.env.PLATFORM_TIME_ZONE || 'Europe/Berlin';
const LOCALE = 'de-DE';

/** "Montag, 12. Oktober 2026" */
export function mailDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: MAIL_TIME_ZONE,
  });
}

/** "12. Oktober 2026" */
export function mailDay(date: Date): string {
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: MAIL_TIME_ZONE });
}

/** "19:30" */
export function mailTime(date: Date): string {
  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: MAIL_TIME_ZONE });
}

/** "1 Kommentar" / "3 Kommentare" */
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The first name for greetings ("Hallo Anna,"). Members are addressed by
 * their first name everywhere; titles such as "Dr." are skipped. Falls back to
 * the full name when there is nothing else.
 */
export function firstName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = parts.find((p) => !/^(dr|prof|mag|dipl)\.?$/i.test(p) && !p.endsWith('.'));
  return first ?? parts[0] ?? '';
}

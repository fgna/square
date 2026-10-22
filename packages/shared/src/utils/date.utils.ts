/**
 * Date helpers shared by web and API. Every formatter takes an optional
 * locale ('en' or 'de'); without one they keep their original English output.
 * The web app passes the member's language through useFormatters().
 */
export type DateLocale = 'en' | 'de';

const INTL_LOCALE: Record<DateLocale, string> = { en: 'en-US', de: 'de-DE' };

function intlLocale(locale?: string): string {
  return INTL_LOCALE[(locale as DateLocale) ?? 'en'] ?? 'en-US';
}

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions, locale?: string): string {
  return toDate(date).toLocaleDateString(intlLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: string | Date, locale?: string): string {
  return toDate(date).toLocaleString(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Clock time: "07:45 PM" in English, "19:45" in German. */
export function formatTime(date: string | Date, locale?: string): string {
  return toDate(date).toLocaleTimeString(intlLocale(locale), { hour: '2-digit', minute: '2-digit' });
}

const AGO: Record<DateLocale, { now: string; m: (n: number) => string; h: (n: number) => string; d: (n: number) => string; w: (n: number) => string }> = {
  en: {
    now: 'just now',
    m: (n) => `${n}m ago`,
    h: (n) => `${n}h ago`,
    d: (n) => `${n}d ago`,
    w: (n) => `${n}w ago`,
  },
  de: {
    now: 'gerade eben',
    m: (n) => `vor ${n} Min.`,
    h: (n) => `vor ${n} Std.`,
    d: (n) => (n === 1 ? 'vor 1 Tag' : `vor ${n} Tagen`),
    w: (n) => (n === 1 ? 'vor 1 Woche' : `vor ${n} Wochen`),
  },
};

export function timeAgo(date: string | Date, locale?: string): string {
  const d = toDate(date);
  const words = AGO[(locale as DateLocale) in AGO ? (locale as DateLocale) : 'en'];
  const diffInSeconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return words.now;
  if (diffInSeconds < 3600) return words.m(Math.floor(diffInSeconds / 60));
  if (diffInSeconds < 86400) return words.h(Math.floor(diffInSeconds / 3600));
  if (diffInSeconds < 604800) return words.d(Math.floor(diffInSeconds / 86400));
  if (diffInSeconds < 2592000) return words.w(Math.floor(diffInSeconds / 604800));
  return formatDate(d, undefined, locale);
}

export function isUpcoming(date: string | Date): boolean {
  return toDate(date) > new Date();
}

export function formatEventDuration(startsAt: string | Date, endsAt: string | Date, locale?: string): string {
  const start = toDate(startsAt);
  const end = toDate(endsAt);

  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${formatDate(start, { month: 'short', day: 'numeric', year: 'numeric' }, locale)} · ${formatTime(start, locale)} – ${formatTime(end, locale)}`;
  }

  return `${formatDateTime(start, locale)} – ${formatDateTime(end, locale)}`;
}

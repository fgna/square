import type { CommunityEvent } from '@community/shared';

function formatIcsDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Built in the browser rather than fetched from the API: a download link
 * cannot carry an Authorization header, and the page already holds everything
 * the file needs.
 */
export function buildEventIcs(event: CommunityEvent, appUrl: string): string {
  const location = event.isVirtual
    ? event.meetingUrl || 'Online'
    : event.location || '';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CommunityPlatform//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Same UID the subscription feed uses, so importing this file and later
    // subscribing updates one entry instead of creating a duplicate.
    `UID:event-${event.id}@community-platform`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.startsAt)}`,
    `DTEND:${formatIcsDate(event.endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
  ];

  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  lines.push(`URL:${appUrl}/events/${event.id}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

export function downloadEventIcs(event: CommunityEvent): void {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const blob = new Blob([buildEventIcs(event, appUrl)], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^\w\s-]/g, '').trim() || 'event'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking in the same tick can cancel the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Google ignores webcal:// links and has no import-from-file URL, so a
 * prefilled "create event" form is the only one-click route into it.
 * One-off by nature — a later cancellation cannot reach the copy.
 */
export function googleCalendarUrl(event: CommunityEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatIcsDate(event.startsAt)}/${formatIcsDate(event.endsAt)}`,
    details: event.description,
    location: event.isVirtual ? event.meetingUrl || 'Online' : event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

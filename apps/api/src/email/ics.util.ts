import { htmlToText } from './html-to-text';
export interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  location?: string;
  url?: string;
  startsAt: Date;
  endsAt: Date;
  organizer?: string;
}

function formatDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export interface IcsInviteOptions {
  /**
   * REQUEST adds the event to the recipient's calendar; CANCEL removes the
   * one added earlier with the same UID. Calendar apps only honour a CANCEL
   * whose SEQUENCE is higher than the REQUEST's, and that names the same
   * ORGANIZER (RFC 5546).
   */
  method?: 'REQUEST' | 'CANCEL';
  /** Must grow with every message about the same UID. Defaults to the current time in seconds. */
  sequence?: number;
  organizerEmail?: string;
  attendeeEmail?: string;
}

export function generateIcs(event: IcsEvent, options: IcsInviteOptions = {}): string {
  const method = options.method ?? 'REQUEST';
  // Seconds since the epoch only ever grow, so a later cancellation always
  // outranks the invitation it withdraws — without storing a counter.
  const sequence = options.sequence ?? Math.floor(Date.now() / 1000);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CommunityPlatform//Events//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTART:${formatDate(event.startsAt)}`,
    `DTEND:${formatDate(event.endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(htmlToText(event.description))}`,
  ];

  if (options.organizerEmail) {
    lines.push(`ORGANIZER;CN=Community:mailto:${options.organizerEmail}`);
  }
  if (options.attendeeEmail) {
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=${method === 'CANCEL' ? 'DECLINED' : 'ACCEPTED'}:mailto:${options.attendeeEmail}`,
    );
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push(
    `DTSTAMP:${formatDate(new Date())}`,
    method === 'CANCEL' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return lines.join('\r\n');
}

export interface CalendarFeedEvent extends IcsEvent {
  /** GOING renders as CONFIRMED, MAYBE as TENTATIVE. */
  tentative?: boolean;
}

/**
 * A subscribable calendar rather than a one-off invitation.
 *
 * The difference to generateIcs() matters: a feed carries METHOD:PUBLISH and
 * holds the complete current set of events. Anything the subscriber is no
 * longer attending is simply absent on the next poll, and the calendar client
 * removes it locally — which is how a cancellation propagates without the
 * server having to reach the user.
 */
export function generateCalendarFeed(
  events: CalendarFeedEvent[],
  calendarName: string,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CommunityPlatform//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    // Hints only — the polling interval is ultimately the client's decision.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(event.startsAt)}`,
      `DTEND:${formatDate(event.endsAt)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(htmlToText(event.description))}`,
    );
    if (event.location) {
      lines.push(`LOCATION:${escapeIcs(event.location)}`);
    }
    if (event.url) {
      lines.push(`URL:${event.url}`);
    }
    lines.push(
      `STATUS:${event.tentative ? 'TENTATIVE' : 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

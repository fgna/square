import { countLabel, mailDate } from './mail-format';

/** The parts of the admin's digest template that shape the e-mail (Admin → Digest). */
export interface DigestLook {
  subject?: string | null;
  /** Shown under the logo: the admin's own words, e.g. a weekly note. Plain text. */
  headerHtml?: string | null;
  /** Shown above the settings link. Plain text. */
  footerHtml?: string | null;
  sections?: string[] | null;
  accentColor?: string | null;
  logoUrl?: string | null;
}

export interface DigestContent {
  userName: string;
  platformName: string;
  frequency: 'DAILY' | 'WEEKLY';
  appUrl: string;
  newPosts: number;
  topPosts: { authorName: string; snippet: string; reactions: number; comments: number }[];
  upcomingEvents: { title: string; startsAt: Date }[];
  upcomingEventCount: number;
  newCourses: { title: string }[];
  unreadNotifications: number;
}

export const DEFAULT_DIGEST_SECTIONS = ['new_posts', 'upcoming_events', 'community_stats'];
const DEFAULT_ACCENT = '#c5a880';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain text with line breaks, as typed by the admin. */
function paragraphs(text: string, style: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${style}">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function block(title: string, body: string, accent: string): string {
  return `
        <tr><td style="padding: 0 32px 16px; background: rgba(17,24,39,0.7);">
          <div style="padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 3px solid ${accent};">
            <div style="font-size: 14px; font-weight: 600; color: #f3f4f6; margin-bottom: 8px;">${escapeHtml(title)}</div>
            ${body}
          </div>
        </td></tr>`;
}

function line(text: string): string {
  return `<div style="font-size: 13px; color: #d1d5db; padding: 4px 0;">${text}</div>`;
}

function muted(text: string): string {
  return `<div style="font-size: 13px; color: #9ca3af;">${escapeHtml(text)}</div>`;
}

function section(name: string, c: DigestContent, accent: string): string {
  switch (name) {
    case 'new_posts':
      return block(
        `Neue Beiträge (${c.newPosts})`,
        c.topPosts.length
          ? c.topPosts
              .map((p) =>
                line(
                  `${escapeHtml(p.snippet)}${p.snippet.length >= 120 ? '…' : ''}<br><span style="font-size: 12px; color: #9ca3af;">von ${escapeHtml(p.authorName)} · ${countLabel(p.reactions, 'Reaktion', 'Reaktionen')} · ${countLabel(p.comments, 'Kommentar', 'Kommentare')}</span>`,
                ),
              )
              .join('')
          : muted('Noch keine neuen Beiträge.'),
        accent,
      );
    case 'upcoming_events':
      return block(
        `Anstehende Veranstaltungen (${c.upcomingEventCount})`,
        c.upcomingEvents.length
          ? c.upcomingEvents.map((e) => line(`<strong>${escapeHtml(mailDate(e.startsAt))}</strong> · ${escapeHtml(e.title)}`)).join('')
          : muted('Gerade sind keine Veranstaltungen geplant.'),
        accent,
      );
    case 'new_courses':
      return c.newCourses.length
        ? block('Neue Kurse', c.newCourses.map((k) => line(escapeHtml(k.title))).join(''), accent)
        : '';
    case 'community_stats':
      return block(
        'Für dich',
        muted(
          `${countLabel(c.unreadNotifications, 'ungelesene Benachrichtigung', 'ungelesene Benachrichtigungen')} · ${countLabel(c.newPosts, 'neuer Beitrag', 'neue Beiträge')}`,
        ),
        accent,
      );
    default:
      return '';
  }
}

/**
 * The digest e-mail, shaped by the admin's active template (logo, accent
 * colour, subject, introduction, sections, closing text). Used for sending,
 * the test send and the preview, so all three look the same.
 */
export function renderDigest(look: DigestLook | null, c: DigestContent): { subject: string; html: string } {
  const accent = look?.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(look.accentColor) ? look.accentColor : DEFAULT_ACCENT;
  const sections = look?.sections?.length ? look.sections : DEFAULT_DIGEST_SECTIONS;
  const heading = c.frequency === 'DAILY' ? 'Deine tägliche Zusammenfassung' : 'Deine Wochenzusammenfassung';
  const cadence = c.frequency === 'DAILY' ? 'täglich' : 'wöchentlich';
  const subject = look?.subject?.trim() || `${c.platformName}: ${heading.replace(/^Deine /, 'deine ')}`;
  const intro = look?.headerHtml?.trim() ?? '';
  const closing = look?.footerHtml?.trim() ?? '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #090d16; padding: 24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="padding: 24px 32px; background: rgba(17,24,39,0.9); border-radius: 12px 12px 0 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
          ${look?.logoUrl ? `<img src="${escapeHtml(look.logoUrl)}" alt="${escapeHtml(c.platformName)}" style="max-height: 40px; margin-bottom: 12px; display: block;" />` : ''}
          <div style="font-size: 20px; font-weight: 600; color: ${accent};">${escapeHtml(c.platformName)}</div>
          <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">${heading}</div>
        </td></tr>

        <tr><td style="padding: 24px 32px 16px; background: rgba(17,24,39,0.7);">
          <div style="font-size: 16px; color: #f3f4f6;">Hallo ${escapeHtml(c.userName)},</div>
          ${intro ? paragraphs(intro, 'font-size: 14px; line-height: 1.6; color: #e5e7eb; margin: 12px 0 0;') : ''}
        </td></tr>

        ${sections.map((s) => section(s, c, accent)).join('\n')}

        <tr><td style="padding: 8px 32px 32px; background: rgba(17,24,39,0.7); border-radius: 0 0 12px 12px;">
          <a href="${escapeHtml(c.appUrl)}/dashboard" style="display: inline-block; padding: 12px 24px; background: ${accent}; color: #090d16; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none;">Zur Plattform</a>
        </td></tr>

        <tr><td style="padding: 24px 32px; text-align: center;">
          ${closing ? paragraphs(closing, 'font-size: 13px; color: #9ca3af; margin: 0 0 12px;') : ''}
          <div style="font-size: 12px; color: #6b7280;">
            Du bekommst diese Zusammenfassung, weil du sie in deinen Einstellungen gewählt hast (${cadence}).
            <a href="${escapeHtml(c.appUrl)}/settings" style="color: ${accent}; text-decoration: underline;">Einstellungen ändern</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

/** When digests go out: DIGEST_DAILY_TIME (default 08:00), DIGEST_WEEKLY (default "MON 08:00"), in PLATFORM_TIME_ZONE. */
export interface DigestSchedule {
  daily: { hour: number; minute: number };
  weekly: { day: number; hour: number; minute: number };
  timeZone: string;
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function parseTime(text: string | undefined, fallback: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((text ?? '').trim()) ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  const hour = Math.min(23, Number(m[1]));
  const minute = Math.min(59, Number(m[2]));
  return { hour, minute };
}

export function digestSchedule(env: NodeJS.ProcessEnv = process.env): DigestSchedule {
  const weekly = (env.DIGEST_WEEKLY ?? 'MON 08:00').trim().toUpperCase().split(/\s+/);
  const day = DAYS.indexOf(weekly[0]?.slice(0, 3));
  return {
    daily: parseTime(env.DIGEST_DAILY_TIME, '08:00'),
    weekly: { day: day >= 0 ? day : 1, ...parseTime(weekly[1], '08:00') },
    timeZone: env.PLATFORM_TIME_ZONE || 'Europe/Berlin',
  };
}

/** Day of week and minutes since midnight of `now` in the time zone. */
function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: DAYS.indexOf(get('weekday').toUpperCase().slice(0, 3)), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** True during the 15 minutes from the configured time (the job runs every 15 minutes). */
export function digestDue(frequency: 'DAILY' | 'WEEKLY', now: Date, schedule: DigestSchedule): boolean {
  const clock = localClock(now, schedule.timeZone);
  const at = frequency === 'DAILY' ? schedule.daily : schedule.weekly;
  if (frequency === 'WEEKLY' && clock.day !== schedule.weekly.day) return false;
  const start = at.hour * 60 + at.minute;
  return clock.minutes >= start && clock.minutes < start + 15;
}

import { firstName } from './mail-format';
import { htmlToText } from './html-to-text';

const ACCENT = '#c5a880';
const EXCERPT_LENGTH = 280;
const SUBJECT_LENGTH = 80;

export interface AnnouncementMail {
  platformName: string;
  appUrl: string;
  userName: string;
  authorName: string;
  postId: string;
  /** The post as stored: editor HTML or plain text. */
  content: string;
  /** e.g. ['audio/mpeg', 'video/mp4'], to say what the post carries. */
  attachmentTypes: string[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const short = text.slice(0, max);
  const space = short.lastIndexOf(' ');
  return `${(space > max * 0.6 ? short.slice(0, space) : short).trimEnd()} …`;
}

/** The first line of the post, its next lines as excerpt. */
export function announcementText(content: string): { headline: string; excerpt: string } {
  const lines = htmlToText(content)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const headline = cut(lines[0] ?? '', SUBJECT_LENGTH);
  const excerpt = cut(lines.slice(1).join(' '), EXCERPT_LENGTH);
  return { headline, excerpt };
}

function carries(types: string[]): string | null {
  if (types.some((t) => t.startsWith('audio/'))) return 'Mit Audiobotschaft';
  if (types.some((t) => t.startsWith('video/'))) return 'Mit Video';
  return null;
}

/**
 * The e-mail members get when an admin publishes an announcement. Only a
 * short excerpt and a link: audio and video stay behind the platform's signed
 * links and are never attached or embedded.
 */
export function renderAnnouncement(m: AnnouncementMail): { subject: string; html: string } {
  const { headline, excerpt } = announcementText(m.content);
  const subject = headline ? `${m.platformName}: ${headline}` : `${m.platformName}: Neue Ankündigung`;
  const link = `${m.appUrl}/feed/${encodeURIComponent(m.postId)}`;
  const badge = carries(m.attachmentTypes);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #090d16; padding: 24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="padding: 24px 32px; background: rgba(17,24,39,0.9); border-radius: 12px 12px 0 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="font-size: 20px; font-weight: 600; color: ${ACCENT};">${escapeHtml(m.platformName)}</div>
          <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">Neue Ankündigung von ${escapeHtml(m.authorName)}</div>
        </td></tr>

        <tr><td style="padding: 32px; background: rgba(17,24,39,0.7);">
          <div style="font-size: 16px; color: #f3f4f6; margin-bottom: 16px;">Hallo ${escapeHtml(firstName(m.userName))},</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
            <tr><td style="padding: 20px;">
              ${headline ? `<div style="font-size: 18px; font-weight: 600; color: #f3f4f6; margin-bottom: 8px;">${escapeHtml(headline)}</div>` : ''}
              ${excerpt ? `<div style="font-size: 14px; line-height: 1.6; color: #d1d5db;">${escapeHtml(excerpt)}</div>` : ''}
              ${badge ? `<div style="font-size: 13px; color: ${ACCENT}; margin-top: 12px;">${badge}</div>` : ''}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding: 0 32px 32px; background: rgba(17,24,39,0.7); border-radius: 0 0 12px 12px;">
          <a href="${escapeHtml(link)}" style="display: inline-block; padding: 12px 24px; background: ${ACCENT}; color: #090d16; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none;">Zur Ankündigung</a>
        </td></tr>

        <tr><td style="padding: 24px 32px; text-align: center;">
          <div style="font-size: 12px; color: #6b7280;">
            Du bekommst diese E-Mail, weil Ankündigungen per E-Mail in deinen Einstellungen eingeschaltet sind.
            <a href="${escapeHtml(m.appUrl)}/settings" style="color: ${ACCENT}; text-decoration: underline;">Einstellungen ändern</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

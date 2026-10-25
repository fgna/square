import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { instanceCapabilities } from '../config/capabilities';

const HOUR = 60 * 60 * 1000;
export const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes since midnight of `now` in the time zone. */
export function localMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return get('hour') * 60 + get('minute');
}

/** The member's reminder time, or null when they switched it off. */
export function reminderTimeFor(choice: string | null, defaultTime: string): string | null {
  if (choice === 'off') return null;
  return choice && REMINDER_TIME.test(choice) ? choice : defaultTime;
}

/**
 * Optional daily e-mail that invites members to complete their journal before
 * the day ends. The instance switches it on (Admin → Settings) and sets a
 * default time; each member keeps it, picks their own time or turns it off.
 * Runs every 15 minutes; at most one reminder per member and day.
 */
@Injectable()
export class JournalReminderService {
  private readonly logger = new Logger(JournalReminderService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  @Cron('*/15 * * * *', { name: 'journal-reminders' })
  async sendDue(now = new Date()) {
    if (!instanceCapabilities.has('journal')) return 0;
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.journalReminders) return 0;
    const timeZone = process.env.PLATFORM_TIME_ZONE || 'Europe/Berlin';
    const minutes = localMinutes(now, timeZone);
    const due = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      const start = h * 60 + m;
      return minutes >= start && minutes < start + 15;
    };

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ journalReminder: null }, { journalReminder: { not: 'off' } }],
        AND: [{ OR: [{ lastJournalReminderAt: null }, { lastJournalReminderAt: { lt: new Date(now.getTime() - 20 * HOUR) } }] }],
      },
      select: { id: true, email: true, name: true, journalReminder: true },
    });
    const recipients = users.filter((u) => {
      const time = reminderTimeFor(u.journalReminder, settings.journalReminderTime);
      return time !== null && due(time);
    });
    if (!recipients.length) return 0;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';
    let sent = 0;
    for (const user of recipients) {
      const ok = await this.email.send({
        to: user.email,
        subject: `${settings.platformName}: Zeit für dein Journal`,
        html: this.html(user.name, settings.platformName, settings.primaryColor, appUrl),
      });
      if (ok) sent++;
    }
    await this.prisma.user.updateMany({ where: { id: { in: recipients.map((u) => u.id) } }, data: { lastJournalReminderAt: now } });
    this.logger.log(`Journal reminders: sent ${sent}/${recipients.length}`);
    return sent;
  }

  private html(name: string, platform: string, color: string, appUrl: string) {
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const accent = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#c5a880';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 32px;background:rgba(17,24,39,0.85);border-radius:12px;">
    <div style="font-size:18px;font-weight:600;color:${accent};">${esc(platform)}</div>
    <p style="font-size:15px;color:#f3f4f6;margin:20px 0 8px;">Hallo ${esc(name)},</p>
    <p style="font-size:14px;line-height:1.6;color:#d1d5db;margin:0 0 20px;">nimm dir ein paar Minuten und schließ deinen Tag im Journal ab, solange er noch frisch ist.</p>
    <a href="${esc(appUrl)}/journal" style="display:inline-block;padding:11px 22px;background:${accent};color:#090d16;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;">Zum Journal</a>
    <p style="font-size:12px;color:#6b7280;margin:24px 0 0;">Uhrzeit ändern oder Erinnerung abschalten: <a href="${esc(appUrl)}/settings" style="color:${accent};">Einstellungen</a></p>
  </div>
</body></html>`;
  }
}

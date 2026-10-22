import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { mailDate, mailTime } from '../email/mail-format';

@Injectable()
export class EventRemindersService {
  private readonly logger = new Logger(EventRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private notifications: NotificationsService,
  ) {}

  @Cron('*/15 * * * *', { name: 'event-reminders' })
  async checkReminders() {
    await this.send24hReminders();
    await this.send1hReminders();
  }

  private async send24hReminders() {
    const now = new Date();
    const in75min = new Date(now.getTime() + 75 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        startsAt: { gt: in75min, lte: in25h },
        reminder24hSent: false,
      },
    });

    if (events.length === 0) return;

    let totalSent = 0;

    for (const event of events) {
      const sent = await this.sendRemindersForEvent(event, 'in 24 Stunden');

      await this.prisma.event.update({
        where: { id: event.id },
        data: { reminder24hSent: true },
      });

      totalSent += sent;
    }

    this.logger.log(`24h reminders: sent ${totalSent} for ${events.length} event(s)`);
  }

  private async send1hReminders() {
    const now = new Date();
    const in75min = new Date(now.getTime() + 75 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        startsAt: { gte: now, lte: in75min },
        reminder1hSent: false,
      },
    });

    if (events.length === 0) return;

    let totalSent = 0;

    for (const event of events) {
      const sent = await this.sendRemindersForEvent(event, 'in einer Stunde');

      await this.prisma.event.update({
        where: { id: event.id },
        data: { reminder1hSent: true },
      });

      totalSent += sent;
    }

    this.logger.log(`1h reminders: sent ${totalSent} for ${events.length} event(s)`);
  }

  private async sendRemindersForEvent(
    event: { id: string; title: string; startsAt: Date; location: string | null; isVirtual: boolean; meetingUrl: string | null },
    timeLabel: string,
  ): Promise<number> {
    const rsvps = await this.prisma.eventRsvp.findMany({
      where: {
        eventId: event.id,
        status: { in: ['GOING', 'MAYBE'] },
        user: { eventReminders: true, isActive: true },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    let sent = 0;
    const platformName = await this.getPlatformName();

    for (const rsvp of rsvps) {
      // Send email
      try {
        const html = this.buildReminderHtml({
          userName: rsvp.user.name,
          platformName,
          eventTitle: event.title,
          startsAt: event.startsAt,
          location: event.location,
          isVirtual: event.isVirtual,
          meetingUrl: event.meetingUrl,
          timeLabel,
        });

        await this.email.send({
          to: rsvp.user.email,
          subject: `${platformName}: „${event.title}“ beginnt ${timeLabel}`,
          html,
        });

        sent++;
      } catch (error) {
        this.logger.error(
          `Failed to send reminder email to ${rsvp.user.email} for event ${event.id}`,
          error,
        );
      }

      // Create in-app notification (fire-and-forget)
      this.notifications
        .create(rsvp.user.id, null, 'EVENT_REMINDER', event.id, 'event')
        .catch((err) =>
          this.logger.error(
            `Failed to create reminder notification for user ${rsvp.user.id}`,
            err,
          ),
        );
    }

    return sent;
  }

  private async getPlatformName(): Promise<string> {
    const settings = await this.prisma.platformSettings.findFirst();
    return settings?.platformName || 'Community';
  }

  private buildReminderHtml(data: {
    userName: string;
    platformName: string;
    eventTitle: string;
    startsAt: Date;
    location: string | null;
    isVirtual: boolean;
    meetingUrl: string | null;
    timeLabel: string;
  }): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';
    const formattedDate = mailDate(data.startsAt);
    const formattedTime = mailTime(data.startsAt);

    const locationHtml = data.isVirtual
      ? `<div style="font-size: 14px; color: #9ca3af; margin-top: 8px;">
           <span style="color: #c5a880;">Online-Veranstaltung</span>${data.meetingUrl ? ` — <a href="${this.escapeHtml(data.meetingUrl)}" style="color: #c5a880; text-decoration: underline;">Zum Online-Termin</a>` : ''}
         </div>`
      : data.location
        ? `<div style="font-size: 14px; color: #9ca3af; margin-top: 8px;">Ort: <span style="color: #e5e7eb;">${this.escapeHtml(data.location)}</span></div>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #090d16; padding: 24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <!-- Header -->
        <tr><td style="padding: 24px 32px; background: rgba(17,24,39,0.9); border-radius: 12px 12px 0 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="font-size: 20px; font-weight: 600; color: #c5a880;">${this.escapeHtml(data.platformName)}</div>
          <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">Erinnerung an deine Veranstaltung</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding: 32px; background: rgba(17,24,39,0.7);">
          <div style="font-size: 16px; color: #f3f4f6; margin-bottom: 16px;">Hallo ${this.escapeHtml(data.userName)},</div>
          <div style="font-size: 14px; color: #9ca3af; margin-bottom: 24px;">
            kurze Erinnerung: Diese Veranstaltung beginnt <strong style="color: #c5a880;">${data.timeLabel}</strong>:
          </div>

          <!-- Event Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
            <tr><td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 600; color: #f3f4f6; margin-bottom: 8px;">${this.escapeHtml(data.eventTitle)}</div>
              <div style="font-size: 14px; color: #9ca3af;">
                <span style="color: #e5e7eb;">${formattedDate}</span> um <span style="color: #e5e7eb;">${formattedTime} Uhr</span>
              </div>
              ${locationHtml}
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding: 0 32px 32px; background: rgba(17,24,39,0.7); border-radius: 0 0 12px 12px;">
          <a href="${appUrl}/events" style="display: inline-block; padding: 12px 24px; background: #c5a880; color: #090d16; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none;">Zur Veranstaltung</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding: 24px 32px; text-align: center;">
          <div style="font-size: 12px; color: #6b7280;">
            Du bekommst diese Erinnerung, weil du zu dieser Veranstaltung zugesagt hast.
            <a href="${appUrl}/settings" style="color: #c5a880; text-decoration: underline;">Benachrichtigungen verwalten</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

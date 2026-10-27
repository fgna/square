import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { countLabel, firstName } from './mail-format';

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'daily-digest' })
  async sendDailyDigests() {
    await this.sendDigests('DAILY');
  }

  @Cron('0 8 * * 1', { name: 'weekly-digest' })
  async sendWeeklyDigests() {
    await this.sendDigests('WEEKLY');
  }

  private async sendDigests(frequency: 'DAILY' | 'WEEKLY') {
    const since = frequency === 'DAILY'
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        emailDigest: frequency,
        isActive: true,
      },
      select: { id: true, email: true, name: true, lastDigestAt: true },
    });

    if (users.length === 0) return;

    const periodStart = since;

    const [newPosts, newEvents, unreadNotifications] = await Promise.all([
      this.prisma.post.count({
        where: { createdAt: { gte: periodStart }, isHidden: false },
      }),
      this.prisma.event.count({
        where: { startsAt: { gte: new Date() } },
      }),
      null,
    ]);

    const topPosts = await this.prisma.post.findMany({
      where: { createdAt: { gte: periodStart }, isHidden: false },
      orderBy: { reactions: { _count: 'desc' } },
      take: 5,
      select: {
        id: true,
        content: true,
        author: { select: { name: true } },
        _count: { select: { reactions: true, comments: true } },
      },
    });

    let sent = 0;
    const platformName = await this.getPlatformName();

    for (const user of users) {
      const userNotifications = await this.prisma.notification.count({
        where: {
          userId: user.id,
          read: false,
          createdAt: { gte: user.lastDigestAt || periodStart },
        },
      });

      const html = this.buildDigestHtml({
        userName: user.name,
        platformName,
        frequency,
        newPosts,
        newEvents,
        unreadNotifications: userNotifications,
        topPosts: topPosts.map((p) => ({
          authorName: p.author.name,
          snippet: this.stripHtml(p.content).slice(0, 120),
          reactions: p._count.reactions,
          comments: p._count.comments,
        })),
      });

      const subject = frequency === 'DAILY'
        ? `${platformName}: deine tägliche Zusammenfassung`
        : `${platformName}: deine Wochenzusammenfassung`;

      const ok = await this.email.send({ to: user.email, subject, html });
      if (ok) sent++;
    }

    await this.prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { lastDigestAt: new Date() },
    });

    this.logger.log(`${frequency} digest: sent ${sent}/${users.length} emails`);
  }

  private async getPlatformName(): Promise<string> {
    const settings = await this.prisma.platformSettings.findFirst();
    return settings?.platformName || 'Community';
  }

  private stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  private buildDigestHtml(data: {
    userName: string;
    platformName: string;
    frequency: string;
    newPosts: number;
    newEvents: number;
    unreadNotifications: number;
    topPosts: { authorName: string; snippet: string; reactions: number; comments: number }[];
  }): string {
    const period = data.frequency === 'DAILY' ? 'heute' : 'diese Woche';
    const heading = data.frequency === 'DAILY' ? 'Deine tägliche Zusammenfassung' : 'Deine Wochenzusammenfassung';
    const cadence = data.frequency === 'DAILY' ? 'täglich' : 'wöchentlich';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';

    const topPostsHtml = data.topPosts.length > 0
      ? data.topPosts.map((p) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #2a2a3a;">
            <div style="font-size: 14px; color: #e5e7eb; margin-bottom: 4px;">${this.escapeHtml(p.snippet)}${p.snippet.length >= 120 ? '...' : ''}</div>
            <div style="font-size: 12px; color: #9ca3af;">von ${this.escapeHtml(p.authorName)} · ${countLabel(p.reactions, 'Reaktion', 'Reaktionen')} · ${countLabel(p.comments, 'Kommentar', 'Kommentare')}</div>
          </td>
        </tr>`).join('')
      : '<tr><td style="padding: 12px 0; color: #9ca3af; font-size: 14px;">Noch keine neuen Beiträge.</td></tr>';

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
          <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">${heading}</div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding: 24px 32px; background: rgba(17,24,39,0.7);">
          <div style="font-size: 16px; color: #f3f4f6;">Hallo ${this.escapeHtml(firstName(data.userName))},</div>
          <div style="font-size: 14px; color: #9ca3af; margin-top: 8px;">Das ist ${period} passiert:</div>
        </td></tr>

        <!-- Stats -->
        <tr><td style="padding: 0 32px 24px; background: rgba(17,24,39,0.7);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; width: 33%;">
                <div style="font-size: 24px; font-weight: 600; color: #c5a880;">${data.newPosts}</div>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Neue Beiträge</div>
              </td>
              <td style="width: 12px;"></td>
              <td style="padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; width: 33%;">
                <div style="font-size: 24px; font-weight: 600; color: #c5a880;">${data.newEvents}</div>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Kommende Veranstaltungen</div>
              </td>
              <td style="width: 12px;"></td>
              <td style="padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; width: 33%;">
                <div style="font-size: 24px; font-weight: 600; color: #c5a880;">${data.unreadNotifications}</div>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Benachrichtigungen</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Top Posts -->
        <tr><td style="padding: 0 32px 24px; background: rgba(17,24,39,0.7);">
          <div style="font-size: 14px; font-weight: 600; color: #f3f4f6; margin-bottom: 12px;">Beliebte Beiträge</div>
          <table width="100%" cellpadding="0" cellspacing="0">${topPostsHtml}</table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding: 0 32px 32px; background: rgba(17,24,39,0.7); border-radius: 0 0 12px 12px;">
          <a href="${appUrl}/dashboard" style="display: inline-block; padding: 12px 24px; background: #c5a880; color: #090d16; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none;">Zur Plattform</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding: 24px 32px; text-align: center;">
          <div style="font-size: 12px; color: #6b7280;">
            Du bekommst diese Zusammenfassung, weil du sie in deinen Einstellungen gewählt hast (${cadence}).
            <a href="${appUrl}/settings" style="color: #c5a880; text-decoration: underline;">Einstellungen ändern</a>
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

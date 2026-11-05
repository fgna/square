import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { absoluteUploadUrl } from '../uploads/public-url';
import { DigestContent, DigestLook, digestDue, digestSchedule, renderDigest } from './digest-render';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /**
   * Runs every 15 minutes and sends the daily and weekly digests at the times
   * set by DIGEST_DAILY_TIME and DIGEST_WEEKLY in the platform time zone. A
   * member who got a digest recently is skipped, so a restart or a second
   * run in the same window never sends twice.
   */
  @Cron('*/15 * * * *', { name: 'digests' })
  async sendDueDigests(now = new Date()) {
    const schedule = digestSchedule();
    if (digestDue('DAILY', now, schedule)) await this.sendDigests('DAILY', now);
    if (digestDue('WEEKLY', now, schedule)) await this.sendDigests('WEEKLY', now);
  }

  async sendDigests(frequency: 'DAILY' | 'WEEKLY', now = new Date()) {
    const periodStart = new Date(now.getTime() - (frequency === 'DAILY' ? 1 : 7) * DAY);
    const notSince = new Date(now.getTime() - (frequency === 'DAILY' ? 20 * HOUR : 6 * DAY));
    const users = await this.prisma.user.findMany({
      where: {
        emailDigest: frequency,
        isActive: true,
        OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: notSince } }],
      },
      select: { id: true, email: true, name: true, lastDigestAt: true },
    });
    if (users.length === 0) return 0;

    const [look, shared] = await Promise.all([this.activeLook(), this.sharedContent(periodStart, now)]);
    let sent = 0;
    for (const user of users) {
      const content = await this.contentFor(user, frequency, periodStart, shared);
      const { subject, html } = renderDigest(look, content);
      if (await this.email.send({ to: user.email, subject, html })) sent++;
    }

    await this.prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { lastDigestAt: now },
    });
    this.logger.log(`${frequency} digest: sent ${sent}/${users.length} emails`);
    return sent;
  }

  /** Sends the weekly digest as it would look now, with real content, to one admin. */
  async sendTest(userId: string, templateId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, lastDigestAt: true } });
    if (!user) throw new NotFoundException('User not found');
    const now = new Date();
    const periodStart = new Date(now.getTime() - 7 * DAY);
    const template = templateId
      ? await this.prisma.digestTemplate.findUnique({ where: { id: templateId } })
      : await this.prisma.digestTemplate.findFirst({ where: { isActive: true } });
    const content = await this.contentFor(user, 'WEEKLY', periodStart, await this.sharedContent(periodStart, now));
    const { subject, html } = renderDigest(template && this.look(template), content);
    const sent = await this.email.send({ to: user.email, subject: `[Test] ${subject}`, html });
    return { sent, to: user.email };
  }

  private look(template: { subject: string; headerHtml: string; footerHtml: string; sections: unknown; accentColor: string; logoUrl: string | null }): DigestLook {
    return {
      subject: template.subject,
      headerHtml: template.headerHtml,
      footerHtml: template.footerHtml,
      sections: Array.isArray(template.sections) ? (template.sections as string[]) : null,
      accentColor: template.accentColor,
      logoUrl: template.logoUrl ? absoluteUploadUrl(template.logoUrl) : null,
    };
  }

  private async activeLook(): Promise<DigestLook | null> {
    const template = await this.prisma.digestTemplate.findFirst({ where: { isActive: true } });
    return template ? this.look(template) : null;
  }

  /** Content that is the same for every member. */
  private async sharedContent(periodStart: Date, now: Date) {
    const [newPosts, topPosts, upcoming, upcomingEventCount, newCourses, platformName] = await Promise.all([
      this.prisma.post.count({ where: { createdAt: { gte: periodStart }, isHidden: false, publishAt: null } }),
      this.prisma.post.findMany({
        where: { createdAt: { gte: periodStart }, isHidden: false, publishAt: null },
        orderBy: { reactions: { _count: 'desc' } },
        take: 5,
        select: { content: true, author: { select: { name: true } }, _count: { select: { reactions: true, comments: true } } },
      }),
      this.prisma.event.findMany({
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        take: 40,
        select: { id: true, title: true, startsAt: true, seriesId: true },
      }),
      this.prisma.event.count({ where: { startsAt: { gte: now } } }),
      this.prisma.course.findMany({
        where: { isPublished: true, createdAt: { gte: periodStart } },
        select: { title: true },
        take: 5,
      }),
      this.getPlatformName(),
    ]);
    // A daily series would fill the list: show each series once, with its next date.
    const seen = new Set<string>();
    const upcomingEvents = upcoming
      .filter((e) => {
        const key = e.seriesId ?? e.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((e) => ({ title: e.title, startsAt: e.startsAt }));
    return {
      platformName,
      newPosts,
      topPosts: topPosts.map((p) => ({
        authorName: p.author.name,
        snippet: this.stripHtml(p.content).slice(0, 120),
        reactions: p._count.reactions,
        comments: p._count.comments,
      })),
      upcomingEvents,
      upcomingEventCount,
      newCourses,
    };
  }

  private async contentFor(
    user: { id: string; name: string; lastDigestAt: Date | null },
    frequency: 'DAILY' | 'WEEKLY',
    periodStart: Date,
    shared: Awaited<ReturnType<DigestService['sharedContent']>>,
  ): Promise<DigestContent> {
    const unreadNotifications = await this.prisma.notification.count({
      where: { userId: user.id, read: false, createdAt: { gte: user.lastDigestAt || periodStart } },
    });
    return {
      ...shared,
      userName: user.name,
      frequency,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000',
      unreadNotifications,
    };
  }

  private async getPlatformName(): Promise<string> {
    const settings = await this.prisma.platformSettings.findFirst();
    return settings?.platformName || 'Community';
  }

  private stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }
}

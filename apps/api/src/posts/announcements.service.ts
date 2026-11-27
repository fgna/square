import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { renderAnnouncement } from '../email/announcement-render';

/**
 * Time after publishing before members are told. The admin attaches the audio
 * of a post published right away only after creating it; the mail and the bell
 * should point to the finished post.
 */
export const ANNOUNCE_AFTER_MS = 2 * 60 * 1000;
/** Announcements older than this are never sent, e.g. one unhidden days later. */
export const ANNOUNCE_WITHIN_MS = 24 * 60 * 60 * 1000;

/**
 * Tells every active member about a newly published announcement (#143): a
 * notification in the bell for everyone, an e-mail for those who did not
 * switch it off. Runs from the per-minute post scheduler, so scheduled
 * announcements go out when they are published, not when they were written.
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async announceDue(now = new Date()): Promise<number> {
    const due = await this.prisma.post.findMany({
      where: {
        type: 'ANNOUNCEMENT',
        announcedAt: null,
        publishAt: null,
        isHidden: false,
        createdAt: {
          lte: new Date(now.getTime() - ANNOUNCE_AFTER_MS),
          gte: new Date(now.getTime() - ANNOUNCE_WITHIN_MS),
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    let announced = 0;
    for (const { id } of due) {
      // Claim first: a second worker or a restart must never send twice.
      const claimed = await this.prisma.post.updateMany({
        where: { id, announcedAt: null },
        data: { announcedAt: now },
      });
      if (!claimed.count) continue;
      await this.announce(id);
      announced++;
    }
    return announced;
  }

  private async announce(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        authorId: true,
        author: { select: { name: true } },
        attachments: { select: { mimeType: true } },
      },
    });
    if (!post) return;

    const members = await this.prisma.user.findMany({
      where: { isActive: true, id: { not: post.authorId } },
      select: { id: true, email: true, name: true, announcementEmails: true },
    });
    if (!members.length) return;

    await this.prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.id,
        actorId: post.authorId,
        type: 'ANNOUNCEMENT' as const,
        entityId: post.id,
        entityType: 'post',
      })),
    });

    const recipients = members.filter((m) => m.announcementEmails);
    if (!recipients.length) return;
    const settings = await this.prisma.platformSettings.findFirst({ select: { platformName: true } });
    const platformName = settings?.platformName || 'Community';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';

    let sent = 0;
    for (const member of recipients) {
      const { subject, html } = renderAnnouncement({
        platformName,
        appUrl,
        userName: member.name,
        authorName: post.author.name,
        postId: post.id,
        content: post.content,
        attachmentTypes: post.attachments.map((a) => a.mimeType),
      });
      try {
        if (await this.email.send({ to: member.email, subject, html })) sent++;
      } catch (err) {
        this.logger.error(`Announcement e-mail to user ${member.id} failed`, err as Error);
      }
    }
    this.logger.log(`Announcement ${post.id}: ${members.length} notified, ${sent} e-mail(s)`);
  }
}

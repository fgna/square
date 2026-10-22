import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GdprService {
  constructor(private prisma: PrismaService) {}

  async getConsent(userId: string) {
    return this.prisma.cookieConsent.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateConsent(userId: string, analytics: boolean, marketing: boolean) {
    const existing = await this.prisma.cookieConsent.findFirst({ where: { userId } });
    if (existing) {
      return this.prisma.cookieConsent.update({
        where: { id: existing.id },
        data: { analytics, marketing },
      });
    }
    return this.prisma.cookieConsent.create({
      data: { userId, analytics, marketing },
    });
  }

  async saveAnonymousConsent(sessionId: string, analytics: boolean, marketing: boolean) {
    if (sessionId.length > 128) {
      throw new BadRequestException('Invalid session ID');
    }
    const existing = await this.prisma.cookieConsent.findFirst({ where: { sessionId } });
    if (existing) {
      return this.prisma.cookieConsent.update({
        where: { id: existing.id },
        data: { analytics, marketing },
      });
    }
    return this.prisma.cookieConsent.create({
      data: { sessionId, analytics, marketing },
    });
  }

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: {
          take: 1000,
          orderBy: { createdAt: 'desc' },
          include: {
            comments: { take: 100 },
            reactions: { take: 100 },
          },
        },
        comments: { take: 1000, orderBy: { createdAt: 'desc' } },
        reactions: { take: 1000, orderBy: { createdAt: 'desc' } },
        courseProgress: { include: { course: { select: { id: true, title: true } } } },
        eventRsvps: { include: { event: { select: { id: true, title: true, startsAt: true } } } },
        cookieConsents: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { passwordHash, ...userData } = user;

    return {
      exportedAt: new Date().toISOString(),
      user: userData,
    };
  }

  /**
   * Deleting an account removes everything that was only ever the member's
   * own: journal, self-assessments, notes, goals, interests, bookmarks,
   * course progress, RSVPs, votes, notifications, follows, group memberships
   * and invitations, sign-in links and consents. What they shared with others
   * — posts, comments, messages, success stories, proposals, reports — stays
   * so conversations remain readable, but the account behind it is
   * anonymised. Before this, only the name and e-mail were overwritten and the
   * journal and self-assessments stayed in the database.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const mine = { where: { userId } };
    await this.prisma.$transaction([
      // Private to the member
      this.prisma.journalEntry.deleteMany(mine),
      this.prisma.assessment.deleteMany(mine), // answers cascade
      this.prisma.courseNote.deleteMany(mine),
      this.prisma.progress.deleteMany(mine),
      this.prisma.goal.deleteMany(mine),
      this.prisma.challenge.deleteMany(mine),
      this.prisma.userInterest.deleteMany(mine),
      this.prisma.bookmark.deleteMany(mine),
      this.prisma.notification.deleteMany(mine),
      this.prisma.eventRsvp.deleteMany(mine),
      this.prisma.pollVote.deleteMany(mine),
      this.prisma.proposalVote.deleteMany(mine),
      this.prisma.reaction.deleteMany(mine),
      this.prisma.testimonialLike.deleteMany(mine),
      this.prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
      this.prisma.learningGroupMember.deleteMany(mine),
      this.prisma.learningGroupInvite.deleteMany({ where: { OR: [{ userId }, { invitedById: userId }] } }),
      this.prisma.oAuthAccount.deleteMany(mine),
      this.prisma.refreshToken.deleteMany(mine),
      this.prisma.cookieConsent.deleteMany(mine),
      // Shared with others: kept, but no longer says who wrote it beyond "deleted"
      this.prisma.testimonial.updateMany({ where: { authorId: userId }, data: { role: null } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@deleted.invalid`,
          name: 'Gelöschtes Mitglied',
          bio: null,
          avatarUrl: null,
          isActive: false,
          passwordHash: 'DELETED',
          // The feed address alone gives access to the member's events.
          calendarToken: null,
        },
      }),
    ]);

    return { message: 'Account deleted successfully' };
  }

  async getPrivacySettings(userId: string) {
    const consent = await this.getConsent(userId);
    return {
      analytics: consent?.analytics ?? false,
      marketing: consent?.marketing ?? false,
    };
  }
}

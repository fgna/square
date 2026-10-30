import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoEmbed } from '../courses/video-url';
import { deleteUnusedHostedVideos, hostedVideoExists, isHostedVideo } from '../videos/hosted-video';
import { GdprService } from '../gdpr/gdpr.service';
import { normalizeAndroidAppDownloadSettings } from '@community/shared/android-app-download';

/** Accounts deleted by their owner keep a placeholder row (see GdprService.deleteAccount). */
export function isDeletedAccount(email: string | null | undefined): boolean {
  return (email ?? '').endsWith('@deleted.invalid');
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private gdpr: GdprService,
  ) {}

  async getStats() {
    const [users, posts, courses, events, activeUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.course.count(),
      this.prisma.event.count(),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    return { users, posts, courses, events, activeUsers };
  }

  async getAllUsers(page = 1, limit = 20) {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { posts: true } },
        },
      }),
      this.prisma.user.count(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId: string, role: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (userId === actorId && role !== 'ADMIN') {
      throw new BadRequestException('Cannot demote yourself');
    }

    if (isDeletedAccount(user.email)) {
      throw new BadRequestException('A deleted account cannot be changed');
    }

    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, email: true, name: true, role: true },
    });

    await this.prisma.auditLog.create({
      data: { action: 'UPDATE_USER_ROLE', resource: `User:${userId}`, metadata: { role }, userId: actorId },
    });

    return updated;
  }

  async toggleUserActive(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new BadRequestException('Cannot deactivate yourself');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    // Reactivating a deleted account brings none of its data back and it
    // cannot sign in; it would only count as an active member again.
    if (isDeletedAccount(user.email)) {
      throw new BadRequestException('A deleted account cannot be restored');
    }

    if (user.role === 'ADMIN' && user.isActive) {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot deactivate the last admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, name: true, isActive: true },
    });

    await this.prisma.auditLog.create({
      data: { action: 'TOGGLE_USER_ACTIVE', resource: `User:${userId}`, metadata: { isActive: updated.isActive }, userId: actorId },
    });

    return updated;
  }

  /**
   * Deletes a member's account for them (e.g. a deletion request by e-mail, or
   * test accounts). Same deletion as "delete my account" in the member's own
   * settings. The admin must type the member's e-mail address as confirmation.
   * Admins are not deleted here: demote them first, so the last-admin guard
   * in updateUserRole applies.
   */
  async deleteUser(userId: string, confirmEmail: string, actorId: string) {
    if (userId === actorId) {
      throw new BadRequestException('Delete your own account in your settings');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (isDeletedAccount(user.email)) {
      throw new BadRequestException('This account is already deleted');
    }
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Demote the admin to member before deleting the account');
    }
    if ((confirmEmail ?? '').trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException('The e-mail address does not match');
    }

    await this.gdpr.deleteAccount(userId);

    // Only the account id: the log must not keep what the deletion removed.
    await this.prisma.auditLog.create({
      data: { action: 'DELETE_USER', resource: `User:${userId}`, userId: actorId },
    });

    return { message: 'Account deleted' };
  }

  async hidePost(postId: string, actorId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { isHidden: !post.isHidden },
    });

    // Hiding a post is the answer to its reports.
    if (updated.isHidden) {
      await this.prisma.postReport.updateMany({
        where: { postId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
    }

    await this.prisma.auditLog.create({
      data: { action: 'HIDE_POST', resource: `Post:${postId}`, metadata: { isHidden: updated.isHidden }, userId: actorId },
    });

    return updated;
  }

  async pinPost(postId: string, actorId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
    });

    await this.prisma.auditLog.create({
      data: { action: 'PIN_POST', resource: `Post:${postId}`, metadata: { isPinned: updated.isPinned }, userId: actorId },
    });

    return updated;
  }

  /**
   * `hidden` (default) and `visible` list posts by visibility; `reported`
   * lists posts members have reported and no admin has dealt with yet,
   * oldest report first, with the reasons given.
   */
  async getModerationQueue(page = 1, limit = 20, status: 'hidden' | 'visible' | 'reported' | boolean = 'hidden') {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;
    // Kept for callers that still pass the old boolean (true = hidden).
    if (typeof status === 'boolean') status = status ? 'hidden' : 'visible';

    const openReports = { where: { resolvedAt: null } };
    const where =
      status === 'reported'
        ? { reports: { some: { resolvedAt: null } } }
        : { isHidden: status === 'hidden' };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true, reactions: true, reports: openReports } },
          ...(status === 'reported' && {
            reports: {
              ...openReports,
              orderBy: { createdAt: 'asc' as const },
              select: { id: true, reason: true, createdAt: true, reporter: { select: { id: true, name: true } } },
            },
          }),
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** An admin looked at the reports and decided the post can stay. */
  async dismissReports(postId: string, actorId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    const { count } = await this.prisma.postReport.updateMany({
      where: { postId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { action: 'DISMISS_REPORTS', resource: `Post:${postId}`, metadata: { count }, userId: actorId },
    });
    return { dismissed: count };
  }

  async getAuditLog(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAnalytics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersLast30d,
      newUsersLast7d,
      totalPosts,
      postsLast30d,
      postsLast7d,
      totalComments,
      totalReactions,
      totalCourses,
      publishedCourses,
      totalEvents,
      upcomingEvents,
      totalRsvps,
      totalMessages,
      totalConversations,
      topPostAuthors,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.post.count({ where: { isHidden: false } }),
      this.prisma.post.count({ where: { isHidden: false, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.post.count({ where: { isHidden: false, createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.comment.count(),
      this.prisma.reaction.count(),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { isPublished: true } }),
      this.prisma.event.count(),
      this.prisma.event.count({ where: { startsAt: { gte: now } } }),
      this.prisma.eventRsvp.count({ where: { status: 'GOING' } }),
      this.prisma.message.count(),
      this.prisma.conversation.count(),
      this.prisma.post.groupBy({
        by: ['authorId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const topAuthors = await this.prisma.user.findMany({
      where: { id: { in: topPostAuthors.map(a => a.authorId) } },
      select: { id: true, name: true, avatarUrl: true },
    });

    return {
      users: { total: totalUsers, active: activeUsers, newLast30d: newUsersLast30d, newLast7d: newUsersLast7d },
      content: { posts: totalPosts, postsLast30d, postsLast7d, comments: totalComments, reactions: totalReactions },
      courses: { total: totalCourses, published: publishedCourses },
      events: { total: totalEvents, upcoming: upcomingEvents, totalRsvps },
      messages: { total: totalMessages, conversations: totalConversations },
      topPostAuthors: topPostAuthors.map(a => ({
        ...topAuthors.find(u => u.id === a.authorId),
        postCount: a._count.id,
      })),
    };
  }

  async getPlatformSettings() {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    if (settings) return settings;
    return this.prisma.platformSettings.create({
      data: { id: 'default', updatedAt: new Date() },
    });
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto) {
    const data = { ...dto };
    let previousWelcome: string | null = null;
    if (dto.androidAppDownloadEnabled !== undefined || dto.androidAppDownloadUrl !== undefined) {
      const current = await this.prisma.platformSettings.findUnique({
        where: { id: 'default' },
        select: { androidAppDownloadEnabled: true, androidAppDownloadUrl: true },
      });
      try {
        // Write the complete valid pair so concurrent partial writes cannot leave
        // an enabled download with an empty URL.
        Object.assign(data, normalizeAndroidAppDownloadSettings(current, dto));
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    }
    if (data.welcomeVideoUrl !== undefined) {
      const url = data.welcomeVideoUrl?.trim() || null;
      // Same as course videos: an uploaded video (must exist), or a host that
      // is embedded and allowed by frame-src.
      if (url && isHostedVideo(url)) {
        if (!hostedVideoExists(url)) throw new BadRequestException('Uploaded video not found');
      } else if (url && !toVideoEmbed(url)) {
        throw new BadRequestException('Welcome video must be an uploaded video or a Loom, Vimeo or YouTube link');
      }
      data.welcomeVideoUrl = url;
      previousWelcome = (await this.prisma.platformSettings.findUnique({ where: { id: 'default' }, select: { welcomeVideoUrl: true } }))?.welcomeVideoUrl ?? null;
    }
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data, updatedAt: new Date() },
      update: { ...data, updatedAt: new Date() },
    });
    // A replaced uploaded welcome video is deleted unless something else uses it.
    if (previousWelcome && previousWelcome !== settings.welcomeVideoUrl) {
      await deleteUnusedHostedVideos(this.prisma, [previousWelcome], this.logger);
    }
    return settings;
  }
}

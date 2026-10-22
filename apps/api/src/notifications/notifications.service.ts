import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    actorId: string | null,
    type: 'REACTION' | 'COMMENT' | 'MENTION' | 'EVENT_REMINDER' | 'MESSAGE' | 'GROUP_INVITE',
    entityId?: string,
    entityType?: string,
  ) {
    if (actorId && userId === actorId) return null;

    return this.prisma.notification.create({
      data: { userId, actorId, type, entityId, entityType },
    });
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data: await this.withEvents(data),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Event reminders have no actor, so without the event itself the bell can
   * only say "Someone Event reminder". Attach the event's title and start
   * time. The event is looked up rather than joined because a notification's
   * entity is polymorphic (entityId + entityType).
   */
  private async withEvents<T extends { entityId: string | null; entityType: string | null }>(
    notifications: T[],
  ): Promise<(T & { event?: { id: string; title: string; startsAt: Date } | null })[]> {
    const eventIds = [
      ...new Set(
        notifications
          .filter((n) => n.entityType === 'event' && n.entityId)
          .map((n) => n.entityId as string),
      ),
    ];
    if (!eventIds.length) return notifications;

    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, title: true, startsAt: true },
    });
    const byId = new Map(events.map((e) => [e.id, e]));

    return notifications.map((n) =>
      n.entityType === 'event' && n.entityId ? { ...n, event: byId.get(n.entityId) ?? null } : n,
    );
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}

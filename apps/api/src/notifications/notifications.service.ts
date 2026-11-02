import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const where = await this.visibleWhere(userId);
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.notification.count({ where }),
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
      where: { ...await this.visibleWhere(userId), read: false },
    });
    return { count };
  }

  // Filter before pagination and counting. Entities are polymorphic, so resolve
  // only this member's reminder targets, without changing historical records.
  private async visibleWhere(userId: string): Promise<Prisma.NotificationWhereInput> {
    const now = new Date();
    const reminders = await this.prisma.notification.findMany({
      where: { userId, type: 'EVENT_REMINDER', entityType: 'event', entityId: { not: null } },
      select: { entityId: true },
      distinct: ['entityId'],
    });
    const events = reminders.length ? await this.prisma.event.findMany({
      where: { id: { in: reminders.map(n => n.entityId as string) }, startsAt: { gt: now } },
      select: { id: true },
    }) : [];
    return {
      userId,
      OR: [
        { type: { not: 'EVENT_REMINDER' } },
        { type: 'EVENT_REMINDER', entityType: 'event', entityId: { in: events.map(e => e.id) } },
      ],
    };
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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  return {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
    },
  };
}

describe('NotificationsService.findAll', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: NotificationsService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    const module = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('attaches the event to an event reminder, so the bell can name it', async () => {
    const startsAt = new Date('2026-09-22T08:00:00Z');
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n1', type: 'EVENT_REMINDER', actor: null, entityId: 'ev1', entityType: 'event' },
      { id: 'n2', type: 'COMMENT', actor: { id: 'u2' }, entityId: 'p1', entityType: 'post' },
    ]);
    prisma.notification.count.mockResolvedValue(2);
    prisma.event.findMany.mockResolvedValue([{ id: 'ev1', title: 'Journaling', startsAt }]);

    const result = await service.findAll('u1');

    expect(result.data[0]).toMatchObject({ event: { id: 'ev1', title: 'Journaling', startsAt } });
    expect(result.data[1]).not.toHaveProperty('event');
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['ev1'] } } }),
    );
  });

  it('marks the event as null when it has since been deleted', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n1', type: 'EVENT_REMINDER', actor: null, entityId: 'gone', entityType: 'event' },
    ]);
    prisma.notification.count.mockResolvedValue(1);
    prisma.event.findMany.mockResolvedValue([]);

    const result = await service.findAll('u1');

    expect(result.data[0]).toHaveProperty('event', null);
  });

  it('skips the event lookup when no notification refers to an event', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n2', type: 'REACTION', actor: { id: 'u2' }, entityId: 'p1', entityType: 'post' },
    ]);
    prisma.notification.count.mockResolvedValue(1);

    await service.findAll('u1');

    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });
});

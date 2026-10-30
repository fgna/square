import { describe, it, expect, vi } from 'vitest';
import { EventRemindersService } from './event-reminders.service';
import { EventsService } from './events.service';

describe('reminder 24 hours ahead, per event', () => {
  it('only asks for events that want the day-ahead reminder', async () => {
    const prisma: any = { event: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() } };
    const service = new EventRemindersService(prisma, { send: vi.fn() } as any, { create: vi.fn() } as any);

    await service.checkReminders();

    expect(prisma.event.findMany.mock.calls[0][0].where).toMatchObject({ reminder24hSent: false, remind24h: true });
    expect(prisma.event.findMany.mock.calls[1][0].where).not.toHaveProperty('remind24h');
  });

  it('switching it off on one date of a series switches it off for the whole series', async () => {
    const start = new Date('2026-11-02T06:45:00Z');
    const prisma: any = {
      event: {
        findUnique: vi.fn().mockResolvedValue({ id: 'e1', seriesId: 's1', startsAt: start, endsAt: new Date(start.getTime() + 2_700_000) }),
        update: vi.fn().mockResolvedValue({ id: 'e1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 260 }),
      },
    };
    const service = new EventsService(prisma, { send: vi.fn() } as any);

    await service.update('e1', { remind24h: false });

    expect(prisma.event.update.mock.calls[0][0].data).toMatchObject({ remind24h: false });
    expect(prisma.event.updateMany).toHaveBeenCalledWith({ where: { seriesId: 's1' }, data: { remind24h: false } });

    prisma.event.updateMany.mockClear();
    await service.update('e1', { title: 'Neu' });
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventsService } from './events.service';

describe('EventsService.findAll: which events a list gets', () => {
  let prisma: any;
  let service: EventsService;

  beforeEach(() => {
    prisma = {
      event: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      eventRsvp: { findMany: vi.fn().mockResolvedValue([]) },
    };
    service = new EventsService(prisma, { send: vi.fn() } as any);
  });

  const query = () => prisma.event.findMany.mock.calls[0][0];

  it('lists events that have not ended yet, soonest first, by default', async () => {
    await service.findAll(1, 20);
    expect(query().where.endsAt.gte).toBeInstanceOf(Date);
    expect(query().orderBy).toEqual({ startsAt: 'asc' });
    expect(prisma.event.count).toHaveBeenCalledWith({ where: query().where });
  });

  it('lists ended events latest first, or all', async () => {
    await service.findAll(1, 20, undefined, { when: 'past' });
    expect(query().where.endsAt.lt).toBeInstanceOf(Date);
    expect(query().orderBy).toEqual({ startsAt: 'desc' });

    prisma.event.findMany.mockClear();
    await service.findAll(1, 20, undefined, { when: 'all' });
    expect(query().where).toEqual({});
  });

  it('selects a period for the calendar, past days included', async () => {
    const from = new Date('2026-10-26T00:00:00Z');
    const to = new Date('2026-12-07T00:00:00Z');
    await service.findAll(1, 100, undefined, { from, to });
    expect(query().where).toEqual({ startsAt: { gte: from, lt: to } });
  });

  it("keeps only the member's yes answers with mine", async () => {
    await service.findAll(1, 20, 'u1', { mine: true });
    expect(query().where.rsvps).toEqual({ some: { userId: 'u1', status: 'GOING' } });
  });

  it("returns the member's own answer even when they are not among the five shown", async () => {
    prisma.event.findMany.mockResolvedValue([{ id: 'e1', rsvps: [] }, { id: 'e2', rsvps: [] }]);
    prisma.eventRsvp.findMany.mockResolvedValue([{ id: 'r1', status: 'GOING', userId: 'u1', eventId: 'e2' }]);
    const { data } = await service.findAll(1, 20, 'u1');
    expect(data[0].userRsvp).toBeNull();
    expect(data[1].userRsvp).toMatchObject({ status: 'GOING' });
  });
});

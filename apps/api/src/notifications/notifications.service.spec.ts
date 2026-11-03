import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

const NOW = new Date('2026-11-02T12:00:00Z');

// Evaluate the Prisma predicates against mixed, member-owned history so the
// regression catches filtering after pagination and inconsistent unread totals.
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((clause: any) => matches(row, clause));
    if (value && typeof value === 'object') {
      if ('not' in value) return row[key] !== value.not;
      if ('in' in value) return value.in.includes(row[key]);
      if ('gt' in value) return row[key] > value.gt;
    }
    return row[key] === value;
  });
}

describe('notification reminder expiration', () => {
  let rows: any[];
  let events: any[];
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    events = [
      { id: 'past', title: 'Past', startsAt: new Date(NOW.getTime() - 1) },
      { id: 'boundary', title: 'Starting', startsAt: NOW },
      { id: 'future', title: 'Upcoming', startsAt: new Date(NOW.getTime() + 1) },
    ];
    rows = ['past', 'boundary', 'gone', 'future'].map((entityId, index) => ({
      id: `r${index}`, userId: 'u1', type: 'EVENT_REMINDER', entityType: 'event', entityId,
      read: false, actor: null,
    }));
    rows.push(
      { id: 'comment', userId: 'u1', type: 'COMMENT', entityType: 'event', entityId: 'past', read: false },
      { id: 'message', userId: 'u1', type: 'MESSAGE', entityType: 'message', entityId: 'm1', read: true },
      { id: 'other-member', userId: 'u2', type: 'MESSAGE', read: false },
      { id: 'malformed', userId: 'u1', type: 'EVENT_REMINDER', entityType: 'post', entityId: 'future', read: false },
      { id: 'null-target', userId: 'u1', type: 'EVENT_REMINDER', entityType: 'event', entityId: null, read: false },
    );
    prisma = {
      notification: {
        findMany: vi.fn(async (args: any) => {
          const matching = rows.filter(row => matches(row, args.where));
          if (args.distinct) return [...new Set(matching.map(row => row.entityId))].map(entityId => ({ entityId }));
          return matching.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
        }),
        count: vi.fn(async (args: any) => rows.filter(row => matches(row, args.where)).length),
      },
      event: {
        findMany: vi.fn(async (args: any) => events.filter(event => matches(event, args.where))),
      },
    };
    service = new NotificationsService(prisma);
  });

  afterEach(() => vi.useRealTimers());

  it('suppresses started, deleted and malformed reminders but preserves ordinary history', async () => {
    const result = await service.findAll('u1');
    expect(result.data.map(row => row.id)).toEqual(['r3', 'comment', 'message']);
    expect(result.total).toBe(3);
    expect(result.data[0]).toMatchObject({ event: { id: 'future', title: 'Upcoming' } });
    expect(result.data[1]).toMatchObject({ event: { id: 'past' } });
    expect(result.data[2]).not.toHaveProperty('event');
    expect(await service.getUnreadCount('u1')).toEqual({ count: 2 });
    expect(rows).toHaveLength(9); // visibility never deletes history
  });

  it('filters before pagination, including totals and empty pages', async () => {
    expect(await service.findAll('u1', 1, 1)).toMatchObject({ total: 3, totalPages: 3, data: [{ id: 'r3' }] });
    expect(await service.findAll('u1', 2, 1)).toMatchObject({ data: [{ id: 'comment' }] });
    expect((await service.findAll('u1', 4, 1)).data).toEqual([]);
  });

  it.each(['UTC', 'Europe/Berlin', 'America/Los_Angeles', 'Asia/Tokyo'])('expires exactly at start independently of %s', async tz => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = tz;
      vi.setSystemTime(new Date(NOW.getTime() + 1));
      expect((await service.findAll('u1')).data.map(row => row.id)).toEqual(['comment', 'message']);
      expect(await service.getUnreadCount('u1')).toEqual({ count: 1 });
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('uses the current event schedule and suppresses a newly deleted event', async () => {
    events[0].startsAt = new Date(NOW.getTime() + 1000);
    expect((await service.findAll('u1')).data.map(row => row.id)).toContain('r0');
    events = events.filter(event => event.id !== 'future');
    expect((await service.findAll('u1')).data.map(row => row.id)).not.toContain('r3');
  });

  it('does not look up event targets when the member has no reminders', async () => {
    rows = rows.filter(row => row.type !== 'EVENT_REMINDER');
    await service.getUnreadCount('u1');
    expect(prisma.event.findMany).not.toHaveBeenCalled();
    expect(await service.getUnreadCount('u2')).toEqual({ count: 1 });
  });
});

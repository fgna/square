import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventRemindersService } from './event-reminders.service';

const NOW = new Date('2026-11-02T12:00:00Z');
const MINUTE = 60_000;
function inRange(date: Date, range: any) {
  return (!range.gt || date > range.gt) && (!range.gte || date >= range.gte) && (!range.lte || date <= range.lte);
}

describe('event reminder delivery windows and claims', () => {
  let event: any;
  let prisma: any;
  let email: any;
  let notifications: any;
  let service: EventRemindersService;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    event = {
      id: 'e1', title: 'Synthetic event', startsAt: new Date(NOW.getTime() + 60 * MINUTE),
      location: null, isVirtual: false, meetingUrl: null,
      remind24h: true, reminder24hSent: false, reminder1hSent: false,
    };
    const eligible = (where: any) => event &&
      (!where.id || where.id === event.id) &&
      (!where.startsAt || inRange(event.startsAt, where.startsAt)) &&
      (!where.AND || where.AND.every((clause: any) => clause.startsAt instanceof Date
        ? event.startsAt.getTime() === clause.startsAt.getTime() : inRange(event.startsAt, clause.startsAt))) &&
      ['remind24h', 'reminder24hSent', 'reminder1hSent'].every(key => where[key] === undefined || event[key] === where[key]);
    prisma = {
      event: {
        findMany: vi.fn(async ({ where }: any) => eligible(where) ? [{ ...event }] : []),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (!eligible(where)) return { count: 0 };
          Object.assign(event, data);
          return { count: 1 };
        }),
        findFirst: vi.fn(async ({ where }: any) => eligible(where) ? { id: event.id } : null),
      },
      eventRsvp: { findMany: vi.fn(async () => [1, 2].map(id => ({ user: { id: `u${id}`, name: 'Test', email: `test${id}@example.invalid` } }))) },
      platformSettings: { findFirst: vi.fn().mockResolvedValue({ platformName: 'Test' }) },
    };
    email = { send: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue({ id: 'n1' }) };
    service = new EventRemindersService(prisma, email, notifications);
  });
  afterEach(() => vi.useRealTimers());

  it.each([-1, 0, 1, 75 * MINUTE, 75 * MINUTE + 1, 25 * 60 * MINUTE, 25 * 60 * MINUTE + 1])(
    'respects the exact window boundary at %i milliseconds from now', async offset => {
      event.startsAt = new Date(NOW.getTime() + offset);
      await service.checkReminders();
      const expected = offset > 0 && offset <= 25 * 60 * MINUTE ? 2 : 0;
      expect(email.send).toHaveBeenCalledTimes(expected);
      expect(notifications.create).toHaveBeenCalledTimes(expected);
      if (expected) {
        expect(event.reminder1hSent).toBe(offset <= 75 * MINUTE);
        expect(event.reminder24hSent).toBe(offset > 75 * MINUTE);
      }
    },
  );

  it('does not replay reminders during overlapping runs or retries', async () => {
    await Promise.all([service.checkReminders(), service.checkReminders()]);
    await service.checkReminders();
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(new Set(notifications.create.mock.calls.map((args: any[]) => args[0])).size).toBe(2);
  });

  it('rechecks the time when selection is delayed before the claim', async () => {
    const original = prisma.event.findMany.getMockImplementation();
    prisma.event.findMany.mockImplementation(async (args: any) => {
      const selected = await original(args);
      if (selected.length) vi.setSystemTime(event.startsAt);
      return selected;
    });
    await service.checkReminders();
    expect(email.send).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('does not deliver if recipient lookup finishes after the start', async () => {
    prisma.eventRsvp.findMany.mockImplementation(async () => {
      vi.setSystemTime(event.startsAt);
      return [{ user: { id: 'u1', name: 'Test', email: 'test@example.invalid' } }];
    });
    await service.checkReminders();
    expect(email.send).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('stops after slow email delivery crosses the start, including subsequent recipients', async () => {
    email.send.mockImplementation(async () => { vi.setSystemTime(event.startsAt); });
    await service.checkReminders();
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it.each(['delete', 'reschedule', 'disable'])('rechecks a %s before delivery', async change => {
    event.startsAt = new Date(NOW.getTime() + 24 * 60 * MINUTE);
    prisma.eventRsvp.findMany.mockImplementation(async () => {
      if (change === 'delete') event = null;
      else if (change === 'disable') event.remind24h = false;
      else event.startsAt = new Date(NOW.getTime() + 48 * 60 * MINUTE);
      return [{ user: { id: 'u1', name: 'Test', email: 'test@example.invalid' } }];
    });
    await service.checkReminders();
    expect(email.send).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('awaits notification persistence and does not replay a partially failed batch', async () => {
    notifications.create.mockRejectedValueOnce(new Error('synthetic persistence failure'));
    await service.checkReminders();
    await service.checkReminders();
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventsService, expandRecurrence } from './events.service';

const BERLIN = 'Europe/Berlin';
const wall = (d: Date) =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d);

describe('expandRecurrence() keeps the wall-clock time across summer time', () => {
  // Monday 19 October 2026, 7:45 in Berlin (summer time, UTC+2).
  const start = new Date('2026-10-19T05:45:00.000Z');

  it('weekly: 7:45 stays 7:45 after the switch on 25 October', () => {
    const dates = expandRecurrence(start, 'WEEKLY', new Date('2026-11-03T00:00:00Z'), BERLIN);

    expect(dates.map(wall)).toEqual(['Mo., 19.10., 07:45', 'Mo., 26.10., 07:45', 'Mo., 02.11., 07:45']);
    expect(dates[1].toISOString()).toBe('2026-10-26T06:45:00.000Z'); // winter time, UTC+1
  });

  it('daily and weekly also hold the time at the switch back to summer time in March', () => {
    const march = new Date('2027-03-26T06:45:00.000Z'); // Friday 26 March 2027, 7:45 winter time

    expect(expandRecurrence(march, 'DAILY', new Date('2027-03-30T00:00:00Z'), BERLIN).map(wall)).toEqual([
      'Fr., 26.03., 07:45', 'Sa., 27.03., 07:45', 'So., 28.03., 07:45', 'Mo., 29.03., 07:45',
    ]);
  });

  it('weekdays: Monday to Friday only, at the same time', () => {
    const dates = expandRecurrence(start, 'WEEKDAYS', new Date('2026-10-31T00:00:00Z'), BERLIN);

    expect(dates.map(wall)).toEqual([
      'Mo., 19.10., 07:45', 'Di., 20.10., 07:45', 'Mi., 21.10., 07:45', 'Do., 22.10., 07:45', 'Fr., 23.10., 07:45',
      'Mo., 26.10., 07:45', 'Di., 27.10., 07:45', 'Mi., 28.10., 07:45', 'Do., 29.10., 07:45', 'Fr., 30.10., 07:45',
    ]);
  });

  it('weekdays starting on a Saturday begins on the Monday', () => {
    const saturday = new Date('2026-10-24T05:45:00.000Z');

    expect(expandRecurrence(saturday, 'WEEKDAYS', new Date('2026-10-28T00:00:00Z'), BERLIN).map(wall)).toEqual([
      'Mo., 26.10., 07:45', 'Di., 27.10., 07:45',
    ]);
  });

  it('weekdays without an end stops at the 12-month horizon (about 260 occurrences)', () => {
    const dates = expandRecurrence(start, 'WEEKDAYS', null, BERLIN);

    expect(dates.length).toBeGreaterThan(255);
    expect(dates.length).toBeLessThanOrEqual(262);
    expect(dates.every((d) => wall(d).endsWith('07:45'))).toBe(true);
  });
});

describe('EventsService series RSVP', () => {
  const future = (days: number) => new Date(Date.now() + days * 86_400_000);
  let prisma: any;
  let email: any;
  let service: EventsService;

  beforeEach(() => {
    prisma = {
      event: { findMany: vi.fn() },
      eventRsvp: { upsert: vi.fn((args) => args), deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      user: { findUnique: vi.fn().mockResolvedValue({ email: 'm@example.com', name: 'M', calendarInvites: true }) },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    email = { send: vi.fn().mockResolvedValue(true) };
    service = new EventsService(prisma, email);
  });

  it('says yes to every upcoming occurrence, skips full ones and sends one confirmation', async () => {
    prisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Journaling', startsAt: future(1), endsAt: future(1), maxRsvps: null, _count: { rsvps: 3 }, rsvps: [] },
      { id: 'e2', title: 'Journaling', startsAt: future(2), endsAt: future(2), maxRsvps: 2, _count: { rsvps: 2 }, rsvps: [] },
      { id: 'e3', title: 'Journaling', startsAt: future(3), endsAt: future(3), maxRsvps: 2, _count: { rsvps: 2 }, rsvps: [{ status: 'GOING' }] },
    ]);

    const result = await service.rsvpSeries('s1', 'u1', 'GOING');

    expect(result).toEqual({ count: 2, skippedFull: 1 });
    expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({ seriesId: 's1', startsAt: { gte: expect.any(Date) } });
    expect(prisma.eventRsvp.upsert.mock.calls.map((c: any) => c[0].where.eventId_userId.eventId)).toEqual(['e1', 'e3']);
    await vi.waitFor(() => expect(email.send).toHaveBeenCalledTimes(1));
    expect(email.send.mock.calls[0][0].subject).toBe('Zugesagt: Journaling (2 Termine)');
    expect(email.send.mock.calls[0][0].icalEvent).toBeUndefined();
  });

  it('sends nothing for "maybe"', async () => {
    prisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'J', startsAt: future(1), endsAt: future(1), maxRsvps: null, _count: { rsvps: 0 }, rsvps: [] },
    ]);

    await service.rsvpSeries('s1', 'u1', 'MAYBE');

    expect(email.send).not.toHaveBeenCalled();
  });

  it('reports a series without upcoming occurrences', async () => {
    prisma.event.findMany.mockResolvedValue([]);

    await expect(service.rsvpSeries('s1', 'u1', 'GOING')).rejects.toThrow('No upcoming occurrences');
  });

  it('withdraws only from upcoming occurrences of the series', async () => {
    const result = await service.cancelSeriesRsvp('s1', 'u1');

    expect(result).toEqual({ count: 3 });
    expect(prisma.eventRsvp.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', event: { seriesId: 's1', startsAt: { gte: expect.any(Date) } } },
    });
  });
});

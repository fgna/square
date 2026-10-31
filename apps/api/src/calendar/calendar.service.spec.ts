/**
 * The feed URL is readable without a login — the token in the path is the only
 * credential. These tests pin down that it is unguessable, revocable, and
 * scoped to exactly one user's own events.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    eventRsvp: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [CalendarService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return module.get<CalendarService>(CalendarService);
}

let prisma: ReturnType<typeof buildMockPrisma>;
let service: CalendarService;

const rsvp = (overrides: any = {}) => ({
  status: 'GOING',
  event: {
    id: 'e1',
    title: 'Monthly Meetup',
    description: 'Community catch-up',
    location: 'Room A',
    isVirtual: false,
    meetingUrl: null,
    startsAt: new Date('2026-10-01T18:00:00.000Z'),
    endsAt: new Date('2026-10-01T19:00:00.000Z'),
  },
  ...overrides,
});

beforeEach(async () => {
  prisma = buildMockPrisma();
  service = await buildService(prisma);
});

describe('feed token', () => {
  it('is created on first request and reused afterwards', async () => {
    prisma.user.findUnique.mockResolvedValue({ calendarToken: null });
    const created = await service.getOrCreateToken('u1');
    expect(prisma.user.update).toHaveBeenCalled();

    prisma.user.update.mockClear();
    prisma.user.findUnique.mockResolvedValue({ calendarToken: created });
    const second = await service.getOrCreateToken('u1');

    expect(second).toBe(created);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('is long and regenerated independently', async () => {
    prisma.user.findUnique.mockResolvedValue({ calendarToken: null });

    const first = await service.getOrCreateToken('u1');
    const second = await service.regenerateToken('u1');

    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(second).not.toBe(first);
  });

  it('regenerating replaces the old token, invalidating the old URL', async () => {
    await service.regenerateToken('u1');

    const written = prisma.user.update.mock.calls[0][0].data.calendarToken;
    expect(typeof written).toBe('string');
    expect(written.length).toBeGreaterThanOrEqual(40);
  });

  it('revoking clears it so the feed stops resolving', async () => {
    await service.revokeToken('u1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { calendarToken: null },
    });
  });
});

describe('feed contents', () => {
  it('an unknown token yields NotFound rather than an empty calendar', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getFeedByToken('nope', 'http://app')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.eventRsvp.findMany).not.toHaveBeenCalled();
  });

  it('only the token holder’s own attended events are queried', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });

    await service.getFeedByToken('tok', 'http://app');

    expect(prisma.eventRsvp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', status: { in: ['GOING', 'MAYBE'] } },
      }),
    );
  });

  it('declined and withdrawn events are absent — that is how cancellation propagates', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });
    prisma.eventRsvp.findMany.mockResolvedValue([]);

    const ics = await service.getFeedByToken('tok', 'http://app');

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('a GOING event is CONFIRMED', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });
    prisma.eventRsvp.findMany.mockResolvedValue([rsvp()]);

    const ics = await service.getFeedByToken('tok', 'http://app');

    expect(ics).toContain('SUMMARY:Monthly Meetup');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('a MAYBE event is TENTATIVE', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });
    prisma.eventRsvp.findMany.mockResolvedValue([rsvp({ status: 'MAYBE' })]);

    const ics = await service.getFeedByToken('tok', 'http://app');

    expect(ics).toContain('STATUS:TENTATIVE');
  });

  it('the UID is stable per event so edits update instead of duplicating', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });
    prisma.eventRsvp.findMany.mockResolvedValue([rsvp()]);

    const first = await service.getFeedByToken('tok', 'http://app');
    const second = await service.getFeedByToken('tok', 'http://app');

    const uid = /UID:(.+)/.exec(first)![1];
    expect(second).toContain(`UID:${uid}`);
    expect(uid).toContain('e1');
  });

  it('a virtual event uses its meeting URL as the location', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });
    prisma.eventRsvp.findMany.mockResolvedValue([
      rsvp({ event: { ...rsvp().event, isVirtual: true, meetingUrl: 'https://meet.example.com/x' } }),
    ]);

    const ics = await service.getFeedByToken('tok', 'http://app');

    expect(ics).toContain('LOCATION:https://meet.example.com/x');
  });

  it('is published as a subscribable calendar, not a one-off invitation', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });

    const ics = await service.getFeedByToken('tok', 'http://app');

    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).not.toContain('METHOD:REQUEST');
    expect(ics).toContain('X-WR-CALNAME:Alice — Community Events');
  });
});

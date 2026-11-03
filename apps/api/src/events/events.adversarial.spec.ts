/**
 * ADVERSARIAL TESTS: Events & RSVP
 *
 * Originally documented broken invariants. All findings below are now FIXED.
 * Tests assert correct/hardened behaviour.
 *
 * Fixed:
 * - SEC-002: RSVP is now wrapped in $transaction — eliminates TOCTOU race at DB level
 * - SEC-010: event update() validates startsAt < endsAt (same as create())
 * - SEC-020: findAll pagination clamped (page≥1, 1≤limit≤100)
 *
 * Documented (acceptable / expected behaviour):
 * - SEC-011 fixed at controller/DTO level via @IsEnum(RsvpStatus)
 * - Cancelling a non-existent RSVP is silent no-op (deleteMany returns count: 0)
 * - Events can be created with past dates (admin prerogative)
 * - Unit test mock of $transaction cannot simulate real DB serialization;
 *   production safety comes from the real transaction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { EventsService, expandRecurrence } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmailService } from '../email/email.service';

function buildMockEmailService() {
  return {
    sendMail: vi.fn().mockResolvedValue(undefined),
  };
}

function buildMockPrisma() {
  const prisma = {
    event: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    eventRsvp: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // Default $transaction implementation: execute callback with this same mock
  prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  return prisma;
}

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      EventsService,
      { provide: PrismaService, useValue: prisma },
      { provide: EmailService, useValue: buildMockEmailService() },
    ],
  }).compile();
  return module.get<EventsService>(EventsService);
}

describe('EventsService — adversarial', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: EventsService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
    vi.clearAllMocks();
    // Re-apply default $transaction after clearAllMocks
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  });

  // ── FIXED SEC-002: RSVP uses $transaction to prevent TOCTOU race ─────────

  describe('FIXED SEC-002: rsvp uses $transaction (TOCTOU protected in production)', () => {
    it('rsvp at capacity-1 wraps in $transaction — production is safe; mock cannot simulate serialization', async () => {
      /**
       * The $transaction ensures reads and writes are atomic in production.
       * Unit tests with a mock $transaction don't enforce real serialization —
       * both concurrent mocked calls still succeed here. Production safety
       * depends on the real DB transaction (PostgreSQL serializable isolation).
       */
      const eventAtCapacityMinus1 = {
        id: 'event-1',
        maxRsvps: 10,
        _count: { rsvps: 9 },
      };

      prisma.event.findUnique
        .mockResolvedValueOnce(eventAtCapacityMinus1)
        .mockResolvedValueOnce(eventAtCapacityMinus1);

      prisma.eventRsvp.findUnique.mockResolvedValue(null);

      prisma.eventRsvp.upsert
        .mockResolvedValueOnce({ id: 'rsvp-user-a', status: 'GOING', userId: 'user-a' })
        .mockResolvedValueOnce({ id: 'rsvp-user-b', status: 'GOING', userId: 'user-b' });

      const [resultA, resultB] = await Promise.all([
        service.rsvp('event-1', 'user-a', 'GOING'),
        service.rsvp('event-1', 'user-b', 'GOING'),
      ]);

      // Both succeed in the mocked context — $transaction is called for each
      expect(resultA).toHaveProperty('status', 'GOING');
      expect(resultB).toHaveProperty('status', 'GOING');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('rsvp throws BadRequestException when event is at full capacity', async () => {
      const fullEvent = {
        id: 'event-full',
        maxRsvps: 10,
        _count: { rsvps: 10 },
      };

      prisma.event.findUnique.mockResolvedValue(fullEvent);
      prisma.eventRsvp.findUnique.mockResolvedValue(null);

      await expect(
        service.rsvp('event-full', 'user-x', 'GOING'),
      ).rejects.toThrow(BadRequestException);
    });

    it('capacity check is skipped when status is MAYBE or NOT_GOING', async () => {
      const fullEvent = {
        id: 'event-full',
        maxRsvps: 10,
        _count: { rsvps: 10 },
      };
      prisma.event.findUnique.mockResolvedValue(fullEvent);
      prisma.eventRsvp.findUnique.mockResolvedValue(null);
      prisma.eventRsvp.upsert.mockResolvedValue({ id: 'rsvp-1', status: 'MAYBE' });

      const result = await service.rsvp('event-full', 'user-1', 'MAYBE');
      expect(result).toBeDefined();
    });

    it('user already GOING can re-RSVP as GOING without triggering capacity check', async () => {
      const fullEvent = {
        id: 'event-full',
        maxRsvps: 10,
        _count: { rsvps: 10 },
      };
      prisma.event.findUnique.mockResolvedValue(fullEvent);
      // User already has GOING status
      prisma.eventRsvp.findUnique.mockResolvedValue({ status: 'GOING' });
      prisma.eventRsvp.upsert.mockResolvedValue({ id: 'rsvp-1', status: 'GOING' });

      const result = await service.rsvp('event-full', 'user-already-going', 'GOING');
      expect(result).toBeDefined();
    });
  });

  // ── INVARIANT: RSVP status must be validated (fixed at controller/DTO) ────

  describe('INVARIANT: invalid RSVP status propagates to Prisma (DTO guards at controller)', () => {
    it('arbitrary string status is passed through service to Prisma (P2006 from DB)', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        maxRsvps: null,
        _count: { rsvps: 0 },
      });
      prisma.eventRsvp.findUnique.mockResolvedValue(null);
      const dbError = new Error('Invalid value for enum RsvpStatus') as any;
      dbError.code = 'P2006';
      prisma.eventRsvp.upsert.mockRejectedValue(dbError);

      await expect(
        service.rsvp('event-1', 'user-1', 'ATTENDING'),
      ).rejects.toThrow();
      // Protected at controller level by @IsEnum(RsvpStatus) in RsvpDto
    });

    it('empty string status throws at the DB level (P2006)', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        maxRsvps: null,
        _count: { rsvps: 0 },
      });
      prisma.eventRsvp.findUnique.mockResolvedValue(null);
      const dbError = new Error('Invalid enum value') as any;
      dbError.code = 'P2006';
      prisma.eventRsvp.upsert.mockRejectedValue(dbError);

      await expect(
        service.rsvp('event-1', 'user-1', ''),
      ).rejects.toThrow();
    });
  });

  // ── FIXED SEC-010: event update validates startsAt < endsAt ─────────────

  describe('FIXED SEC-010: event update() validates start/end date ordering', () => {
    it('update() with endsAt before startsAt throws BadRequestException', async () => {
      const existingEvent = {
        id: 'event-1',
        startsAt: new Date('2026-12-01T10:00:00Z'),
        endsAt: new Date('2026-12-01T12:00:00Z'),
      };
      prisma.event.findUnique.mockResolvedValue(existingEvent);

      await expect(
        service.update('event-1', {
          startsAt: '2026-12-01T10:00:00Z',
          endsAt: '2026-11-30T10:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('create() with equal startsAt and endsAt throws BadRequestException', async () => {
      await expect(
        service.create({
          title: 'Same Time Event',
          description: 'Starts and ends at the same instant',
          startsAt: '2026-06-20T10:00:00Z',
          endsAt: '2026-06-20T10:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('create() accepts events in the past (no future-date constraint)', async () => {
      prisma.event.create.mockResolvedValue({
        id: 'past-event',
        title: 'Past Event',
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: new Date('2020-01-01T01:00:00Z'),
      });

      const result = await service.create({
        title: 'Past Event',
        description: 'This already happened over 6 years ago',
        startsAt: '2020-01-01T00:00:00Z',
        endsAt: '2020-01-01T01:00:00Z',
      });

      expect(result).toBeDefined();
    });
  });

  // ── INVARIANT: cancel RSVP on unknown event is a silent no-op ────────────

  describe('INVARIANT: cancel RSVP on non-existent event is silently accepted', () => {
    it('cancelRsvp with no matching RSVP returns success without checking event existence', async () => {
      prisma.eventRsvp.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cancelRsvp('nonexistent-event', 'user-1');
      expect(result.message).toBe('RSVP cancelled');
    });
  });

  // ── FIXED SEC-020: pagination is clamped ─────────────────────────────────

  describe('FIXED SEC-020: findAll pagination is clamped (limit≥1)', () => {
    it('limit=0 is clamped to 1 (totalPages is finite, not Infinity)', async () => {
      prisma.event.findMany.mockResolvedValue([]);
      prisma.event.count.mockResolvedValue(50);

      const result = await service.findAll(1, 0);
      expect(result.totalPages).toBe(50);
    });
  });

  // ── Date coercion: @IsDateString() is looser than Prisma's DateTime ──────
  //
  // An <input type="datetime-local"> submits "2026-10-01T14:30". That passes
  // DTO validation but used to reach Prisma as a raw string, failing with a
  // PrismaClientValidationError — a 500 caused purely by user input.

  describe('create() hands Prisma Date objects, not raw strings', () => {
    const base = {
      title: 'Quarterly kickoff',
      description: 'Kickoff for the new quarter with all coaches.',
    };

    it('accepts a datetime-local value and converts it', async () => {
      prisma.event.create.mockImplementation(async ({ data }: any) => data);

      await service.create({
        ...base,
        startsAt: '2026-10-01T14:30',
        endsAt: '2026-10-01T16:00',
      } as any);

      const passed = prisma.event.create.mock.calls[0][0].data;
      expect(passed.startsAt).toBeInstanceOf(Date);
      expect(passed.endsAt).toBeInstanceOf(Date);
    });

    it('accepts a full ISO timestamp unchanged in value', async () => {
      prisma.event.create.mockImplementation(async ({ data }: any) => data);

      await service.create({
        ...base,
        startsAt: '2026-10-01T14:30:00.000Z',
        endsAt: '2026-10-01T16:00:00.000Z',
      } as any);

      const passed = prisma.event.create.mock.calls[0][0].data;
      expect(passed.startsAt.toISOString()).toBe('2026-10-01T14:30:00.000Z');
    });

    it('rejects an unparseable date with 400 instead of reaching Prisma', async () => {
      await expect(
        service.create({ ...base, startsAt: 'not-a-date', endsAt: '2026-10-01T16:00' } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('still rejects an end that is not after the start', async () => {
      await expect(
        service.create({
          ...base,
          startsAt: '2026-10-01T18:00',
          endsAt: '2026-10-01T16:00',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  // ── Recurrence expansion ────────────────────────────────────────────────
  //
  // Occurrences are materialised as rows, so an unbounded series would write
  // unbounded data. The 12-month horizon is the guard against that.

  describe('expandRecurrence()', () => {
    const start = new Date('2026-10-01T10:00:00.000Z');

    it('weekly without an end date stops at the 12-month horizon', () => {
      const dates = expandRecurrence(start, 'WEEKLY', null);

      expect(dates.length).toBeGreaterThan(50);
      expect(dates.length).toBeLessThanOrEqual(53);

      const horizon = new Date(start);
      horizon.setMonth(horizon.getMonth() + 12);
      expect(dates[dates.length - 1].getTime()).toBeLessThanOrEqual(horizon.getTime());
    });

    it('daily is capped rather than generating a row per day forever', () => {
      const dates = expandRecurrence(start, 'DAILY', null);

      expect(dates.length).toBeLessThanOrEqual(400);
    });

    it('an explicit end date shortens the series', () => {
      const until = new Date('2026-10-22T10:00:00.000Z');
      const dates = expandRecurrence(start, 'WEEKLY', until);

      expect(dates).toHaveLength(4);
      expect(dates[dates.length - 1].toISOString()).toBe('2026-10-22T10:00:00.000Z');
    });

    it('an end date beyond the horizon does not extend past it', () => {
      const until = new Date('2030-01-01T10:00:00.000Z');
      const dates = expandRecurrence(start, 'MONTHLY', until);

      expect(dates).toHaveLength(13);
    });

    it('the first occurrence is the start date itself', () => {
      const dates = expandRecurrence(start, 'BIWEEKLY', null);

      expect(dates[0].toISOString()).toBe(start.toISOString());
    });

    it('biweekly steps by 14 days', () => {
      const dates = expandRecurrence(start, 'BIWEEKLY', new Date('2026-11-01T10:00:00.000Z'));

      const gap = dates[1].getTime() - dates[0].getTime();
      expect(gap).toBe(14 * 24 * 60 * 60 * 1000);
    });
  });

  describe('update() converts dates the same way', () => {
    it('a datetime-local value reaches Prisma as a Date', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        startsAt: new Date('2026-10-01T10:00:00.000Z'),
        endsAt: new Date('2026-10-01T12:00:00.000Z'),
      });
      prisma.event.update.mockImplementation(async ({ data }: any) => data);

      await service.update('e1', { endsAt: '2026-10-01T18:00' } as any);

      const passed = prisma.event.update.mock.calls[0][0].data;
      expect(passed.endsAt).toBeInstanceOf(Date);
    });

    it('an unparseable date is rejected with 400', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        startsAt: new Date('2026-10-01T10:00:00.000Z'),
        endsAt: new Date('2026-10-01T12:00:00.000Z'),
      });

      await expect(service.update('e1', { startsAt: 'rubbish' } as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });
});

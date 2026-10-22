import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { EventsService } from './events.service';
import { eventUrl } from './event-url';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

const event = {
  id: 'ev1',
  title: 'Journaling',
  description: 'Weekly session',
  startsAt: new Date('2026-09-22T08:00:00Z'),
  endsAt: new Date('2026-09-22T09:00:00Z'),
  isVirtual: true,
  meetingUrl: null,
  location: null,
  maxRsvps: null,
  _count: { rsvps: 0 },
};

function buildMocks() {
  const prisma = {
    event: { findUnique: vi.fn(), delete: vi.fn() },
    eventRsvp: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma));
  prisma.user.findUnique.mockResolvedValue({ email: 'alice@example.com', name: 'Alice', calendarInvites: true });
  const email = { send: vi.fn().mockResolvedValue(true) };
  return { prisma, email };
}

describe('calendar cancellations', () => {
  let prisma: ReturnType<typeof buildMocks>['prisma'];
  let email: ReturnType<typeof buildMocks>['email'];
  let service: EventsService;

  beforeEach(async () => {
    ({ prisma, email } = buildMocks());
    const module = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    service = module.get(EventsService);
  });

  const cancellations = () => email.send.mock.calls.filter(([p]) => p.icalMethod === 'CANCEL');

  it('withdraws the calendar invitation when a GOING RSVP is cancelled', async () => {
    prisma.eventRsvp.findUnique.mockResolvedValue({ status: 'GOING', event });
    prisma.eventRsvp.deleteMany.mockResolvedValue({ count: 1 });

    await service.cancelRsvp('ev1', 'u1');

    await vi.waitFor(() => expect(cancellations()).toHaveLength(1));
    const [payload] = cancellations()[0];
    expect(payload.to).toBe('alice@example.com');
    expect(payload.icalEvent).toContain('METHOD:CANCEL');
    expect(payload.icalEvent).toContain('UID:ev1@community');
  });

  it('sends nothing for a MAYBE, which never received an invitation', async () => {
    prisma.eventRsvp.findUnique.mockResolvedValue({ status: 'MAYBE', event });
    prisma.eventRsvp.deleteMany.mockResolvedValue({ count: 1 });

    await service.cancelRsvp('ev1', 'u1');
    await new Promise((r) => setTimeout(r, 10));

    expect(email.send).not.toHaveBeenCalled();
  });

  it('withdraws the invitation when GOING changes to MAYBE', async () => {
    prisma.event.findUnique.mockResolvedValue(event);
    prisma.eventRsvp.findUnique.mockResolvedValue({ status: 'GOING' });
    prisma.eventRsvp.upsert.mockResolvedValue({ id: 'r1', status: 'MAYBE' });

    await service.rsvp('ev1', 'u1', 'MAYBE');

    await vi.waitFor(() => expect(cancellations()).toHaveLength(1));
  });

  it('withdraws every invitation when the event is deleted', async () => {
    prisma.event.findUnique.mockResolvedValue({ ...event, rsvps: [{ userId: 'u1' }, { userId: 'u2' }] });
    prisma.event.delete.mockResolvedValue(event);

    await service.delete('ev1');

    await vi.waitFor(() => expect(cancellations()).toHaveLength(2));
  });

  it('respects members who turned calendar invites off', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'a@x', name: 'A', calendarInvites: false });
    prisma.eventRsvp.findUnique.mockResolvedValue({ status: 'GOING', event });
    prisma.eventRsvp.deleteMany.mockResolvedValue({ count: 1 });

    await service.cancelRsvp('ev1', 'u1');
    await new Promise((r) => setTimeout(r, 10));

    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('eventUrl', () => {
  it('points at the events list, since /events/<id> does not exist', () => {
    expect(eventUrl('https://community.example', 'ev1')).toBe('https://community.example/events#event-ev1');
  });
});

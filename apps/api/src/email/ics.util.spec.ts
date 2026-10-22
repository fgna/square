import { describe, it, expect } from 'vitest';
import { generateIcs } from './ics.util';

const event = {
  uid: 'ev1@community',
  title: 'Journaling',
  description: 'Weekly session',
  startsAt: new Date('2026-09-22T08:00:00Z'),
  endsAt: new Date('2026-09-22T09:00:00Z'),
};

const lines = (ics: string) => ics.split('\r\n');

describe('generateIcs', () => {
  it('invites by default, as before', () => {
    const ics = lines(generateIcs(event));
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('withdraws an invitation with the same UID, CANCEL and CANCELLED', () => {
    const ics = lines(generateIcs(event, { method: 'CANCEL', sequence: 2 }));
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('UID:ev1@community');
    expect(ics).toContain('SEQUENCE:2');
  });

  it('names organizer and attendee, which calendar apps need to match a cancellation', () => {
    const ics = lines(
      generateIcs(event, {
        method: 'CANCEL',
        organizerEmail: 'noreply@community.local',
        attendeeEmail: 'alice@example.com',
      }),
    );
    expect(ics).toContain('ORGANIZER;CN=Community:mailto:noreply@community.local');
    expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=DECLINED:mailto:alice@example.com');
  });

  it('gives a later message a higher sequence without being told', async () => {
    const seq = (ics: string) => Number(lines(ics).find((l) => l.startsWith('SEQUENCE:'))!.slice(9));
    const invite = generateIcs(event);
    await new Promise((r) => setTimeout(r, 1100));
    const cancel = generateIcs(event, { method: 'CANCEL' });
    expect(seq(cancel)).toBeGreaterThan(seq(invite));
  });
});

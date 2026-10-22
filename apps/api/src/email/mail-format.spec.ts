import { describe, it, expect } from 'vitest';
import { mailDate, mailDay, mailTime, countLabel } from './mail-format';

describe('mail-format', () => {
  // 17:30 UTC on a summer day is 19:30 in Germany.
  const summerEvening = new Date('2026-07-15T17:30:00Z');

  it('formats times in German time, not the server clock (UTC in a container)', () => {
    expect(mailTime(summerEvening)).toBe('19:30');
  });

  it('writes dates in German', () => {
    expect(mailDate(summerEvening)).toBe('Mittwoch, 15. Juli 2026');
    expect(mailDay(summerEvening)).toBe('15. Juli 2026');
  });

  it('picks singular or plural', () => {
    expect(countLabel(1, 'Kommentar', 'Kommentare')).toBe('1 Kommentar');
    expect(countLabel(3, 'Kommentar', 'Kommentare')).toBe('3 Kommentare');
  });
});

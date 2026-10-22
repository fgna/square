import { describe, it, expect } from 'vitest';
import { defaultEventTimes, followEnd } from './event-times';

describe('defaultEventTimes', () => {
  it('starts at the next full hour and lasts an hour', () => {
    expect(defaultEventTimes(new Date(2026, 8, 22, 14, 37))).toEqual({
      startsAt: '2026-09-22T15:00',
      endsAt: '2026-09-22T16:00',
    });
  });

  it('rolls over midnight', () => {
    expect(defaultEventTimes(new Date(2026, 8, 22, 23, 10)).startsAt).toBe('2026-09-23T00:00');
  });
});

describe('followEnd', () => {
  it('keeps the duration when the start moves', () => {
    expect(followEnd('2026-09-22T15:00', '2026-09-24T09:00', '2026-09-22T16:30')).toBe('2026-09-24T10:30');
  });

  it('proposes start + 1 hour when no end was set', () => {
    expect(followEnd('', '2026-09-24T09:00', '')).toBe('2026-09-24T10:00');
  });
});

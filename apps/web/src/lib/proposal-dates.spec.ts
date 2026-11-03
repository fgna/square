import { describe, it, expect } from 'vitest';
import { formatProposedDate, joinProposedDate, splitProposedDate } from './proposal-dates';

describe('proposed dates', () => {
  it('stores a start with an end time on the same day as an interval', () => {
    expect(joinProposedDate('2026-11-05T18:00', '19:30')).toBe('2026-11-05T18:00/2026-11-05T19:30');
    expect(joinProposedDate('2026-11-05T18:00', '')).toBe('2026-11-05T18:00');
    expect(joinProposedDate('', '19:30')).toBe('');
  });

  it('reads both forms back', () => {
    expect(splitProposedDate('2026-11-05T18:00/2026-11-05T19:30')).toEqual({ start: '2026-11-05T18:00', end: '2026-11-05T19:30' });
    expect(splitProposedDate('2026-11-05T18:00')).toEqual({ start: '2026-11-05T18:00', end: undefined });
  });

  it('shows the end time after the start', () => {
    expect(formatProposedDate('2026-11-05T18:00/2026-11-05T19:30', 'de')).toMatch(/18:00–19:30$/);
    expect(formatProposedDate('2026-11-05T18:00', 'de')).not.toContain('–');
  });
});

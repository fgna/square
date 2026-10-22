import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeAgo, formatTime, formatDate } from '@community/shared';

describe('date utils in German', () => {
  afterEach(() => vi.useRealTimers());

  it('says how long ago in German', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T12:00:00Z'));
    expect(timeAgo('2026-09-22T11:00:00Z', 'de')).toBe('vor 1 Std.');
    expect(timeAgo('2026-09-21T12:00:00Z', 'de')).toBe('vor 1 Tag');
    expect(timeAgo('2026-09-19T12:00:00Z', 'de')).toBe('vor 3 Tagen');
    expect(timeAgo('2026-09-22T11:00:00Z')).toBe('1h ago');
  });

  it('uses the 24-hour clock and German month names', () => {
    expect(formatTime(new Date(2026, 8, 23, 19, 45), 'de')).toBe('19:45');
    expect(formatDate(new Date(2026, 8, 23), undefined, 'de')).toBe('23. September 2026');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { JournalEntryStore } from '../../data/journal-entries.store';
import { ContentPackService } from '../../data/content-pack.service';
import { JournalService } from './journal.service';

const originalTz = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

async function stats(now: string, dates: string[]) {
  vi.useFakeTimers({ now: new Date(now), toFake: ['Date'] });
  const entryDates = vi.fn().mockResolvedValue(dates.map(d => new Date(`${d}T00:00:00Z`)));
  const service = new JournalService(
    {} as PrismaService,
    { dates: entryDates } as unknown as JournalEntryStore,
    {} as ContentPackService,
  );
  const result = await service.getStats('member-1');
  expect(entryDates).toHaveBeenCalledWith('member-1');
  return result;
}

describe.each(['UTC', 'Europe/Berlin', 'America/Los_Angeles', 'Asia/Tokyo'])(
  'journal statistics on a %s server', (tz) => {
    it('counts today, yesterday and window boundaries using UTC dates near midnight', async () => {
      process.env.TZ = tz;
      const result = await stats('2026-11-02T00:30:00Z', [
        '2026-11-02', '2026-11-01', '2026-10-31',
        '2026-10-03', '2026-10-02', // inclusive 30-day cutoff, then outside
        '2026-08-04', '2026-08-03', // inclusive 90-day cutoff, then outside
      ]);
      expect(result).toEqual({
        totalEntries: 7, currentStreak: 3, longestStreak: 3, last30DaysCount: 4,
        entriesByDate: {
          '2026-11-02': true, '2026-11-01': true, '2026-10-31': true,
          '2026-10-03': true, '2026-10-02': true, '2026-08-04': true,
        },
      });
    });

    it('allows yesterday to continue a streak across a DST change', async () => {
      process.env.TZ = tz;
      expect(await stats('2026-03-30T23:30:00Z', ['2026-03-29', '2026-03-28', '2026-03-27']))
        .toMatchObject({ currentStreak: 3, longestStreak: 3, last30DaysCount: 3 });
    });

    it('stops at gaps and crosses year boundaries', async () => {
      process.env.TZ = tz;
      expect(await stats('2027-01-01T00:30:00Z', [
        '2027-01-01', '2026-12-31', '2026-12-29', '2026-12-28', '2026-12-27',
      ])).toMatchObject({ currentStreak: 2, longestStreak: 3 });
    });

    it('returns zero statistics for a member without entries', async () => {
      process.env.TZ = tz;
      expect(await stats('2026-11-02T00:30:00Z', [])).toEqual({
        totalEntries: 0, currentStreak: 0, longestStreak: 0,
        last30DaysCount: 0, entriesByDate: {},
      });
    });
  },
);

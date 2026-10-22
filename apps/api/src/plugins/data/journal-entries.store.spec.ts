import { describe, it, expect, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryStore } from './journal-entries.store';

function store(journalEntry: Record<string, unknown>) {
  return new JournalEntryStore({ journalEntry } as unknown as PrismaService);
}
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

describe('JournalEntryStore', () => {
  it('lists a member\'s entries in a range, newest first', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await store({ findMany }).list('u1', { from: '2026-10-01', to: '2026-11-01' });
    expect(findMany).toHaveBeenCalledWith({ where: { userId: 'u1', date: { gte: day('2026-10-01'), lt: day('2026-11-01') } }, orderBy: { date: 'desc' } });
  });

  it('stores plain JSON content and no moods unless given', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'e1' });
    await store({ upsert }).save('u1', '2026-10-21', { content: { text: 'hi', skip: undefined, at: day('2026-10-21') } });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: 'u1', date: day('2026-10-21') } },
      create: { userId: 'u1', date: day('2026-10-21'), content: { text: 'hi', at: '2026-10-21T00:00:00.000Z' }, moods: [] },
      update: { content: { text: 'hi', at: '2026-10-21T00:00:00.000Z' }, moods: [] },
    });
  });

  it('reports whether there was an entry to remove', async () => {
    const del = vi.fn();
    expect(await store({ findUnique: vi.fn().mockResolvedValue(null), delete: del }).remove('u1', '2026-10-21')).toBe(false);
    expect(del).not.toHaveBeenCalled();
    expect(await store({ findUnique: vi.fn().mockResolvedValue({ id: 'e1' }), delete: del }).remove('u1', '2026-10-21')).toBe(true);
    expect(del).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });

  it('rejects days that are not YYYY-MM-DD with 400', async () => {
    const findUnique = vi.fn();
    expect(() => store({ findUnique }).get('u1', '21.10.2026')).toThrow('Invalid date format');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns the days with an entry', async () => {
    const findMany = vi.fn().mockResolvedValue([{ date: day('2026-10-21') }, { date: day('2026-10-20') }]);
    expect(await store({ findMany }).dates('u1')).toEqual([day('2026-10-21'), day('2026-10-20')]);
  });
});

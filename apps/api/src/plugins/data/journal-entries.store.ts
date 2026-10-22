import { BadRequestException, Injectable } from '@nestjs/common';
import type { JournalEntryRecord, PluginJournalEntries } from '@community/plugin-sdk/api';
import { PrismaService } from '../../prisma/prisma.service';

const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/** Parses "YYYY-MM-DD" to 00:00 UTC; anything else is a 400. */
export function parseJournalDate(date: string): Date {
  if (!DATE_REGEX.test(date)) {
    throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD.');
  }
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date value.');
  }
  return parsed;
}

/** Journal entries (one per member and day) for the journal plugin; see PluginJournalEntries. */
@Injectable()
export class JournalEntryStore implements PluginJournalEntries {
  constructor(private prisma: PrismaService) {}

  list(userId: string, range?: { from: string; to: string }): Promise<JournalEntryRecord[]> {
    const where: { userId: string; date?: { gte: Date; lt: Date } } = { userId };
    if (range) where.date = { gte: parseJournalDate(range.from), lt: parseJournalDate(range.to) };
    return this.prisma.journalEntry.findMany({ where, orderBy: { date: 'desc' } });
  }

  get(userId: string, date: string): Promise<JournalEntryRecord | null> {
    return this.prisma.journalEntry.findUnique({ where: { userId_date: { userId, date: parseJournalDate(date) } } });
  }

  save(userId: string, date: string, entry: { content: unknown; moods?: string[] }): Promise<JournalEntryRecord> {
    const day = parseJournalDate(date);
    // Round-trip through JSON: stores plain data only (no class instances, no undefined).
    const content = JSON.parse(JSON.stringify(entry.content));
    const moods = entry.moods ?? [];
    return this.prisma.journalEntry.upsert({
      where: { userId_date: { userId, date: day } },
      create: { userId, date: day, content, moods },
      update: { content, moods },
    });
  }

  async remove(userId: string, date: string): Promise<boolean> {
    const entry = await this.get(userId, date);
    if (!entry) return false;
    await this.prisma.journalEntry.delete({ where: { id: entry.id } });
    return true;
  }

  async dates(userId: string): Promise<Date[]> {
    const rows = await this.prisma.journalEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return rows.map((r) => r.date);
  }
}

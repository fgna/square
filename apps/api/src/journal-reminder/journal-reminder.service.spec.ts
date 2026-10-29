import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JournalReminderService, reminderTimeFor } from './journal-reminder.service';

describe('journal reminders', () => {
  let prisma: any;
  let email: any;
  let service: JournalReminderService;
  // Monday 26.10.2026 16:30 in Berlin = 15:30 UTC (winter time).
  const at1630 = new Date('2026-10-26T15:30:00Z');

  beforeEach(() => {
    vi.stubEnv('PLATFORM_TIME_ZONE', 'Europe/Berlin');
    prisma = {
      platformSettings: { findUnique: vi.fn().mockResolvedValue({ journalReminders: true, journalReminderTime: '16:30', platformName: 'Community', primaryColor: '#c5a880' }) },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', email: 'a@example.test', name: 'Anna Beispiel', journalReminder: null },
          { id: 'b', email: 'b@example.test', name: 'B', journalReminder: '18:00' },
          { id: 'c', email: 'c@example.test', name: 'C', journalReminder: '16:30' },
        ]),
        updateMany: vi.fn(),
      },
    };
    email = { send: vi.fn().mockResolvedValue(true) };
    service = new JournalReminderService(prisma, email);
  });

  it('reads each member\'s choice: default time, own time or off', () => {
    expect(reminderTimeFor(null, '16:30')).toBe('16:30');
    expect(reminderTimeFor('18:00', '16:30')).toBe('18:00');
    expect(reminderTimeFor('off', '16:30')).toBeNull();
  });

  it('reminds members whose time has come, once a day, with a link to the journal', async () => {
    expect(await service.sendDue(at1630)).toBe(2);
    expect(email.send.mock.calls.map((c: any[]) => c[0].to)).toEqual(['a@example.test', 'c@example.test']);
    expect(email.send.mock.calls[0][0].html).toContain('/journal');
    expect(email.send.mock.calls[0][0].html).toContain('Hallo Anna,');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'c'] } }, data: { lastJournalReminderAt: at1630 } });
    // Off and recently reminded members are excluded in the query.
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"off"');
    expect(where.AND[0].OR[1].lastJournalReminderAt.lt).toBeInstanceOf(Date);
  });

  it('sends nothing while the instance has reminders switched off', async () => {
    prisma.platformSettings.findUnique.mockResolvedValue({ journalReminders: false, journalReminderTime: '16:30' });
    expect(await service.sendDue(at1630)).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

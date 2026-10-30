import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DigestService } from './digest.service';

describe('DigestService', () => {
  let prisma: any;
  let email: any;
  let service: DigestService;
  const now = new Date('2026-10-30T14:05:00Z');

  beforeEach(() => {
    prisma = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: 'u1', email: 'a@example.test', name: 'Alex', lastDigestAt: null }]), updateMany: vi.fn(), findUnique: vi.fn() },
      post: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      event: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'e1', title: 'Daily', startsAt: new Date('2026-10-31T06:45:00Z'), seriesId: 's1' },
          { id: 'e2', title: 'Daily', startsAt: new Date('2026-11-01T06:45:00Z'), seriesId: 's1' },
          { id: 'e3', title: 'Workshop', startsAt: new Date('2026-11-02T15:00:00Z'), seriesId: null },
        ]),
        count: vi.fn().mockResolvedValue(3),
      },
      course: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { count: vi.fn().mockResolvedValue(0) },
      platformSettings: { findFirst: vi.fn().mockResolvedValue({ platformName: 'Community' }) },
      digestTemplate: {
        findFirst: vi.fn().mockResolvedValue({ subject: 'Unsere Woche', headerHtml: 'Hallo zusammen', footerHtml: '', sections: ['upcoming_events'], accentColor: '#112233', logoUrl: null }),
        findUnique: vi.fn(),
      },
    };
    email = { send: vi.fn().mockResolvedValue(true) };
    service = new DigestService(prisma, email);
  });

  it("sends with the admin's active template and shows a daily series once", async () => {
    await service.sendDigests('WEEKLY', now);
    const { subject, html } = email.send.mock.calls[0][0];
    expect(subject).toBe('Unsere Woche');
    expect(html).toContain('Hallo zusammen');
    expect(html).toContain('#112233');
    expect(html.match(/· Daily/g)).toHaveLength(1);
    expect(html).toContain('Workshop');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['u1'] } }, data: { lastDigestAt: now } });
  });

  it('skips members who got their digest recently, so a second run never sends twice', async () => {
    await service.sendDigests('WEEKLY', now);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.emailDigest).toBe('WEEKLY');
    expect(where.OR[1].lastDigestAt.lt.getTime()).toBe(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  });

  it('sends at the configured weekly time only', async () => {
    vi.stubEnv('DIGEST_WEEKLY', 'FRI 15:00');
    vi.stubEnv('PLATFORM_TIME_ZONE', 'Europe/Berlin');
    const spy = vi.spyOn(service, 'sendDigests').mockResolvedValue(0);
    await service.sendDueDigests(now);
    expect(spy).toHaveBeenCalledWith('WEEKLY', now);
    spy.mockClear();
    await service.sendDueDigests(new Date('2026-10-30T16:05:00Z'));
    expect(spy).not.toHaveBeenCalledWith('WEEKLY', expect.anything());
    vi.unstubAllEnvs();
  });

  it('sends a test to the admin with real content', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'admin@example.test', name: 'Admin', lastDigestAt: null });
    prisma.digestTemplate.findUnique.mockResolvedValue({ subject: 'Entwurf', headerHtml: '', footerHtml: '', sections: [], accentColor: '#c5a880', logoUrl: null });
    await expect(service.sendTest('u1', 't1')).resolves.toEqual({ sent: true, to: 'admin@example.test' });
    expect(email.send.mock.calls[0][0].subject).toBe('[Test] Entwurf');
  });
});

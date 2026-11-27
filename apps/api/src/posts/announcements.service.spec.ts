import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnouncementsService, ANNOUNCE_AFTER_MS, ANNOUNCE_WITHIN_MS } from './announcements.service';
import { PostSchedulerService } from './post-scheduler.service';

const now = new Date('2026-11-30T06:05:00Z');

const POST = {
  id: 'p1',
  content: '<p>Monday Motivator: Wachstum</p><p>Diese Woche geht es um G wie Growth.</p>',
  authorId: 'admin1',
  author: { name: 'Peter Creutzfeldt' },
  attachments: [{ mimeType: 'audio/mpeg' }],
};

function setup(members = [
  { id: 'u1', email: 'u1@example.test', name: 'Anna Beispiel', announcementEmails: true },
  { id: 'u2', email: 'u2@example.test', name: 'Ben Muster', announcementEmails: false },
]) {
  const prisma = {
    post: {
      findMany: vi.fn().mockResolvedValue([{ id: 'p1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(POST),
    },
    user: { findMany: vi.fn().mockResolvedValue(members) },
    notification: { createMany: vi.fn().mockResolvedValue({ count: members.length }) },
    platformSettings: { findFirst: vi.fn().mockResolvedValue({ platformName: 'GrowthLeaders' }) },
  };
  const email = { send: vi.fn().mockResolvedValue(true) };
  return { prisma, email, service: new AnnouncementsService(prisma as never, email as never) };
}

describe('AnnouncementsService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('looks only at published, visible, unannounced announcements from the last day, after the grace time', async () => {
    const { service, prisma } = setup();
    await service.announceDue(now);
    expect(prisma.post.findMany.mock.calls[0][0].where).toEqual({
      type: 'ANNOUNCEMENT',
      announcedAt: null,
      publishAt: null,
      isHidden: false,
      createdAt: {
        lte: new Date(now.getTime() - ANNOUNCE_AFTER_MS),
        gte: new Date(now.getTime() - ANNOUNCE_WITHIN_MS),
      },
    });
  });

  it('claims the post before sending, so it goes out once', async () => {
    const { service, prisma } = setup();
    expect(await service.announceDue(now)).toBe(1);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({ where: { id: 'p1', announcedAt: null }, data: { announcedAt: now } });
  });

  it('sends nothing when another run already claimed the post', async () => {
    const { service, prisma, email } = setup();
    prisma.post.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.announceDue(now)).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('notifies every active member except the author in the bell', async () => {
    const { service, prisma } = setup();
    await service.announceDue(now);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ isActive: true, id: { not: 'admin1' } });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', actorId: 'admin1', type: 'ANNOUNCEMENT', entityId: 'p1', entityType: 'post' },
        { userId: 'u2', actorId: 'admin1', type: 'ANNOUNCEMENT', entityId: 'p1', entityType: 'post' },
      ],
    });
  });

  it('e-mails only members who keep announcement e-mails on', async () => {
    const { service, email } = setup();
    await service.announceDue(now);
    expect(email.send).toHaveBeenCalledTimes(1);
    const mail = email.send.mock.calls[0][0];
    expect(mail.to).toBe('u1@example.test');
    expect(mail.subject).toBe('GrowthLeaders: Monday Motivator: Wachstum');
    expect(mail.html).toContain('Hallo Anna,');
    expect(mail.html).toContain('/feed/p1');
    expect(mail.html).toContain('Mit Audiobotschaft');
  });

  it('keeps sending when one e-mail fails', async () => {
    const { service, email } = setup([
      { id: 'u1', email: 'u1@example.test', name: 'Anna', announcementEmails: true },
      { id: 'u3', email: 'u3@example.test', name: 'Cem', announcementEmails: true },
    ]);
    email.send.mockRejectedValueOnce(new Error('SMTP down'));
    await service.announceDue(now);
    expect(email.send).toHaveBeenCalledTimes(2);
  });

  it('does nothing without due announcements', async () => {
    const { service, prisma, email } = setup();
    prisma.post.findMany.mockResolvedValue([]);
    expect(await service.announceDue(now)).toBe(0);
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('PostSchedulerService', () => {
  it('publishes scheduled posts before announcing, and announces even if publishing failed', async () => {
    const order: string[] = [];
    const posts = { publishDue: vi.fn(async () => { order.push('publish'); throw new Error('db'); }) };
    const announcements = { announceDue: vi.fn(async () => { order.push('announce'); return 0; }) };
    await new PostSchedulerService(posts as never, announcements as never).run();
    expect(order).toEqual(['publish', 'announce']);
  });
});

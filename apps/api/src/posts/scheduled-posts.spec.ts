import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService, scheduleTime } from './posts.service';
import { PostsController } from './posts.controller';
import { BookmarksService } from './bookmarks.service';

const now = new Date('2026-11-01T18:00:00Z');
const monday = '2026-11-02T05:00:00.000Z';

function setup() {
  const prisma = { post: {
    create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'p1', ...data })),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findUnique: vi.fn(),
    update: vi.fn().mockImplementation(async ({ data }) => ({ id: 'p1', ...data })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  } };
  return { prisma, service: new PostsService(prisma as never, {} as never) };
}

describe('Scheduled posts', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });

  it('lets admins schedule a post for later', async () => {
    const { service, prisma } = setup();
    await service.create({ content: 'Monday Motivator', publishAt: monday }, 'admin1', 'ADMIN');
    expect(prisma.post.create.mock.calls[0][0].data.publishAt).toEqual(new Date(monday));
  });

  it('refuses scheduling by members and times in the past or too far ahead', async () => {
    const { service, prisma } = setup();
    await expect(service.create({ content: 'x', publishAt: monday }, 'u1', 'MEMBER')).rejects.toThrow(ForbiddenException);
    await expect(service.create({ content: 'x', publishAt: '2026-11-01T17:00:00Z' }, 'admin1', 'ADMIN')).rejects.toThrow(BadRequestException);
    expect(() => scheduleTime('2028-01-01T00:00:00Z')).toThrow(BadRequestException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('keeps scheduled posts out of the feed and the single view', async () => {
    const { service, prisma } = setup();
    await service.findAll(1, 20, 'u1');
    expect(prisma.post.findMany.mock.calls[0][0].where).toMatchObject({ isHidden: false, publishAt: null });
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.findOne('p1')).rejects.toThrow(NotFoundException);
    expect(prisma.post.findUnique.mock.calls[0][0].where).toMatchObject({ id: 'p1', publishAt: null });
  });

  it('publishes due posts at their scheduled time, so they top the feed', async () => {
    const { service, prisma } = setup();
    const at = new Date('2026-11-01T17:59:00Z');
    prisma.post.findMany.mockResolvedValue([{ id: 'p1', publishAt: at }]);
    expect(await service.publishDue()).toBe(1);
    expect(prisma.post.findMany.mock.calls[0][0].where).toEqual({ publishAt: { lte: now } });
    expect(prisma.post.updateMany).toHaveBeenCalledWith({ where: { id: 'p1', publishAt: at }, data: { publishAt: null, createdAt: at } });
  });

  it('moves a scheduled post or publishes it now', async () => {
    const { service, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue({ publishAt: new Date(monday) });
    await service.reschedule('p1', '2026-11-03T05:00:00Z');
    expect(prisma.post.update.mock.calls[0][0].data).toEqual({ publishAt: new Date('2026-11-03T05:00:00Z') });
    await service.reschedule('p1', null);
    expect(prisma.post.update.mock.calls[1][0].data).toEqual({ publishAt: null, createdAt: now });
    prisma.post.findUnique.mockResolvedValue({ publishAt: null });
    await expect(service.reschedule('p1', null)).rejects.toThrow(NotFoundException);
  });

  it('does not let members bookmark a post before it is published', async () => {
    const prisma = { post: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', publishAt: new Date(monday) }) }, bookmark: { findUnique: vi.fn(), create: vi.fn() } };
    await expect(new BookmarksService(prisma as never).toggle('u1', 'p1')).rejects.toThrow(NotFoundException);
    expect(prisma.bookmark.create).not.toHaveBeenCalled();
  });

  it('reserves the schedule list and rescheduling for admins', () => {
    const proto = PostsController.prototype as any;
    expect(Reflect.getMetadata('roles', proto.findScheduled)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata('roles', proto.reschedule)).toEqual(['ADMIN']);
  });
});

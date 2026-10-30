import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { sanitizeRichText as sanitizeContent } from '../common/sanitize-rich-text';
import { signUploadPath } from '../uploads/attachment-links';
import { absoluteUploadUrl } from '../uploads/public-url';
import { removeUploadedFiles } from '../uploads/remove-uploaded-files';
import { deleteUnusedHostedVideos, hostedVideoExists, hostedVideoFile, isHostedVideo } from '../videos/hosted-video';
import { statSync } from 'fs';

const pollSelect = {
  id: true,
  question: true,
  endsAt: true,
  createdAt: true,
  options: {
    select: {
      id: true,
      text: true,
      order: true,
      _count: { select: { votes: true } },
    },
    orderBy: { order: 'asc' as const },
  },
};

const postSelect = {
  id: true,
  content: true,
  type: true,
  authorId: true,
  isPinned: true,
  isHidden: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, name: true, avatarUrl: true, role: true },
  },
  categories: {
    select: { category: { select: { id: true, name: true, slug: true, icon: true, color: true } } },
  },
  poll: { select: pollSelect },
  attachments: {
    select: { id: true, filename: true, url: true, mimeType: true, size: true, order: true },
    orderBy: { order: 'asc' as const },
  },
  _count: {
    select: { comments: true, reactions: true },
  },
};

/**
 * Attachment files (audio, uploaded videos) are only reachable through a
 * signed link that expires, like course documents.
 */
function withAttachmentLinks<P extends { attachments?: { url: string }[] }>(post: P): P {
  if (!post.attachments) return post;
  return { ...post, attachments: post.attachments.map((a) => ({ ...a, url: absoluteUploadUrl(signUploadPath(a.url)) })) };
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(page = 1, limit = 20, userId?: string, type?: string, prioritize?: string) {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;
    const where: any = { isHidden: false };
    if (type) where.type = type;

    const selectWithUser = {
      ...postSelect,
      reactions: userId
        ? { where: { userId }, select: { id: true, type: true, userId: true } }
        : false,
      poll: {
        select: {
          ...pollSelect,
          options: {
            select: {
              id: true,
              text: true,
              order: true,
              _count: { select: { votes: true } },
              votes: userId ? { where: { userId }, select: { id: true } } : false,
            },
            orderBy: { order: 'asc' as const },
          },
          votes: userId ? { where: { userId }, select: { optionId: true } } : false,
        },
      },
    };

    // Posts on the member's interests come first — across all pages, not just
    // within the page that happens to be loaded (#117). The feed is read as
    // three groups one after another: pinned posts, then posts tagged with one
    // of the member's interests, then the rest; each newest first. Page
    // boundaries run straight through the groups.
    if (prioritize === 'interests' && userId) {
      const userInterests = await this.prisma.userInterest.findMany({
        where: { userId },
        select: { categoryId: true },
      });
      const interestCategoryIds = userInterests.map((i) => i.categoryId);

      if (interestCategoryIds.length > 0) {
        const onInterests = { categories: { some: { categoryId: { in: interestCategoryIds } } } };
        const groups = [
          { ...where, isPinned: true },
          { ...where, isPinned: false, ...onInterests },
          { ...where, isPinned: false, NOT: onInterests },
        ];
        const counts = await Promise.all(groups.map((g) => this.prisma.post.count({ where: g })));

        const data: any[] = [];
        let offset = skip;
        for (let i = 0; i < groups.length && data.length < limit; i++) {
          if (offset >= counts[i]) {
            offset -= counts[i];
            continue;
          }
          const rows = await this.prisma.post.findMany({
            where: groups[i],
            skip: offset,
            take: limit - data.length,
            orderBy: { createdAt: 'desc' },
            select: selectWithUser,
          });
          data.push(...rows);
          offset = 0;
        }

        const total = counts.reduce((sum, c) => sum + c, 0);
        return {
          data: data.map(withAttachmentLinks),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        select: selectWithUser,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: data.map(withAttachmentLinks),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id, isHidden: false },
      select: {
        ...postSelect,
        comments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: { id: true, name: true, avatarUrl: true, role: true },
            },
          },
        },
        reactions: {
          select: { id: true, type: true, userId: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return withAttachmentLinks(post);
  }

  async create(dto: CreatePostDto, authorId: string, authorRole?: string) {
    // Announcements are reserved for admins, so they stay rare enough to be read.
    if (dto.type === 'ANNOUNCEMENT' && authorRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can post announcements');
    }
    const sanitized = sanitizeContent(dto.content);
    const post = await this.prisma.post.create({
      data: {
        content: sanitized,
        type: (dto.type as any) || 'DISCUSSION',
        authorId,
        ...(dto.categoryIds?.length && {
          categories: {
            create: dto.categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
        ...(dto.poll && {
          poll: {
            create: {
              question: dto.poll.question,
              endsAt: dto.poll.endsAt ? new Date(dto.poll.endsAt) : undefined,
              options: {
                create: dto.poll.options.map((text, order) => ({ text, order })),
              },
            },
          },
        }),
      },
      select: postSelect,
    });

    if (dto.type === 'INTRODUCTION') {
      await this.prisma.user.update({
        where: { id: authorId },
        data: { hasIntroduced: true },
      });
    }

    return withAttachmentLinks(post);
  }

  async update(id: string, content: string, userId: string, userRole: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot edit this post');
    }
    if (post.isHidden && userRole !== 'ADMIN') {
      throw new ForbiddenException('Post is not available');
    }

    const sanitized = sanitizeContent(content);
    return withAttachmentLinks(
      await this.prisma.post.update({
        where: { id },
        data: { content: sanitized },
        select: postSelect,
      }),
    );
  }

  /**
   * Admins attach audio (an upload from POST /uploads/file) or a video
   * uploaded to the platform (POST /videos/uploads) to a post.
   */
  async addAttachment(postId: string, input: { uploadId?: string; videoUrl?: string }) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    let file: { filename: string; url: string; mimeType: string; size: number };
    if (input.videoUrl) {
      if (!isHostedVideo(input.videoUrl) || !hostedVideoExists(input.videoUrl)) {
        throw new BadRequestException('Uploaded video not found');
      }
      file = { filename: 'video.mp4', url: input.videoUrl, mimeType: 'video/mp4', size: statSync(hostedVideoFile(input.videoUrl)!).size };
    } else if (input.uploadId) {
      const upload = await this.prisma.upload.findUnique({ where: { id: input.uploadId } });
      if (!upload) throw new NotFoundException('Upload not found');
      if (!upload.mimeType.startsWith('audio/')) throw new BadRequestException('Only audio and videos can be attached to posts');
      file = { filename: upload.filename, url: upload.url, mimeType: upload.mimeType, size: upload.size };
    } else {
      throw new BadRequestException('uploadId or videoUrl required');
    }
    const last = await this.prisma.postAttachment.findFirst({ where: { postId }, orderBy: { order: 'desc' } });
    const attachment = await this.prisma.postAttachment.create({
      data: { postId, ...file, order: (last?.order ?? 0) + 1 },
    });
    return { ...attachment, url: absoluteUploadUrl(signUploadPath(attachment.url)) };
  }

  async deleteAttachment(attachmentId: string) {
    const attachment = await this.prisma.postAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.prisma.postAttachment.delete({ where: { id: attachmentId } });
    await this.removeAttachmentFiles([attachment.url]);
    return { message: 'Attachment removed' };
  }

  /** Audio files are deleted; a video only once nothing else uses it. */
  private async removeAttachmentFiles(urls: string[]) {
    await removeUploadedFiles(urls.filter((u) => !isHostedVideo(u)), this.logger);
    await deleteUnusedHostedVideos(this.prisma, urls, this.logger);
  }

  /**
   * Flags a post for the admins. Reporting again updates the reason and
   * reopens it — one report per member and post, however often they click.
   */
  async report(postId: string, reporterId: string, reason: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId, isHidden: false } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId === reporterId) throw new BadRequestException('You cannot report your own post');

    await this.prisma.postReport.upsert({
      where: { postId_reporterId: { postId, reporterId } },
      update: { reason: reason.trim(), resolvedAt: null },
      create: { postId, reporterId, reason: reason.trim() },
    });
    return { reported: true };
  }

  async delete(id: string, userId: string, userRole: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot delete this post');
    }
    if (post.isHidden && userRole !== 'ADMIN') {
      throw new ForbiddenException('Post is not available');
    }

    const files = await this.prisma.postAttachment.findMany({ where: { postId: id }, select: { url: true } });
    await this.prisma.post.delete({ where: { id } });
    if (files.length) await this.removeAttachmentFiles(files.map((f) => f.url));
    return { message: 'Post deleted' };
  }

  async addComment(postId: string, dto: CreateCommentDto, authorId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId, isHidden: false } });
    if (!post) throw new NotFoundException('Post not found');

    const comment = await this.prisma.comment.create({
      data: { content: dto.content, postId, authorId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        postId: true,
        authorId: true,
        author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    this.notifications.create(post.authorId, authorId, 'COMMENT', postId, 'post').catch((err) => this.logger.error('Failed to create comment notification', err));

    return comment;
  }

  async toggleReaction(postId: string, type: string, userId: string) {
    const VALID_TYPES = ['LIKE', 'HEART', 'CELEBRATE', 'INSIGHTFUL'];
    if (!VALID_TYPES.includes(type)) {
      throw new BadRequestException(`Invalid reaction type. Must be one of: ${VALID_TYPES.join(', ')}`);
    }

    const post = await this.prisma.post.findUnique({ where: { id: postId, isHidden: false } });
    if (!post) throw new NotFoundException('Post not found');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.reaction.findUnique({
          where: { postId_userId_type: { postId, userId, type: type as any } },
        });

        if (existing) {
          await tx.reaction.delete({ where: { id: existing.id } });
          return { removed: true, type };
        }

        const reaction = await tx.reaction.create({
          data: { postId, userId, type: type as any },
          select: { id: true, type: true, userId: true },
        });

        return { added: true, reaction };
      });

      if ((result as any).added) {
        this.notifications.create(post.authorId, userId, 'REACTION', postId, 'post').catch((err) => this.logger.error('Failed to create reaction notification', err));
      }

      return result;
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Reaction already exists');
      throw err;
    }
  }

  async votePoll(postId: string, optionId: string, userId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { postId },
      include: { options: { select: { id: true } } },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.endsAt && poll.endsAt < new Date()) {
      throw new BadRequestException('Poll has ended');
    }

    const validOption = poll.options.some((o) => o.id === optionId);
    if (!validOption) throw new NotFoundException('Poll option not found');

    const vote = await this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId } },
      create: { pollId: poll.id, optionId, userId },
      update: { optionId },
      select: { id: true, optionId: true, userId: true, createdAt: true },
    });

    return vote;
  }

  async unvotePoll(postId: string, userId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { postId } });
    if (!poll) throw new NotFoundException('Poll not found');

    await this.prisma.pollVote.deleteMany({ where: { pollId: poll.id, userId } });
    return { message: 'Vote removed' };
  }
}

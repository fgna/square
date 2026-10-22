import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';

const EXCERPT_LENGTH = 120;

function excerpt(content: string): string {
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
}

/**
 * Hiding a post used to be the only tool, and the author never learned why.
 * This hides it and tells the author privately — as a direct message from
 * the moderating admin, so they can reply, edit the post, and ask for it to
 * be shown again.
 */
@Injectable()
export class ModerationFeedbackService {
  constructor(
    private prisma: PrismaService,
    private messages: MessagesService,
  ) {}

  async hideWithFeedback(postId: string, adminId: string, feedback: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId === adminId) throw new BadRequestException('This is your own post');

    await this.prisma.post.update({ where: { id: postId }, data: { isHidden: true } });
    await this.prisma.postReport.updateMany({ where: { postId, resolvedAt: null }, data: { resolvedAt: new Date() } });

    const conversation = await this.messages.getOrCreateConversation(adminId, post.authorId);
    await this.messages.sendMessage(
      conversation.id,
      {
        content:
          `I have hidden your post for now: “${excerpt(post.content)}”\n\n` +
          `${feedback.trim()}\n\n` +
          'You can edit it and reply here, and I will take another look.',
      },
      adminId,
    );

    await this.prisma.auditLog.create({
      data: { action: 'HIDE_POST_WITH_FEEDBACK', resource: `Post:${postId}`, metadata: { authorId: post.authorId }, userId: adminId },
    });
    return { hidden: true, conversationId: conversation.id };
  }
}

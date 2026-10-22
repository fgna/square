import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getOrCreateConversation(userId: string, otherUserId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        participants: {
          every: { userId: { in: [userId, otherUserId] } },
        },
        AND: {
          participants: { some: { userId } },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true },
        },
      },
    });

    if (existing) {
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId: existing.id },
      });
      if (participants.length === 2 &&
          participants.some(p => p.userId === userId) &&
          participants.some(p => p.userId === otherUserId)) {
        return existing;
      }
    }

    const other = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other) throw new NotFoundException('User not found');

    return this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true },
        },
      },
    });
  }

  async listConversations(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, content: true, senderId: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return participations.map(p => p.conversation);
  }

  async getMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    await this.assertParticipant(conversationId, userId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    // Reading the conversation settles its message notifications too.
    await this.prisma.notification.updateMany({
      where: { userId, type: 'MESSAGE', entityId: conversationId, read: false },
      data: { read: true },
    });

    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });

    return { data: data.reverse(), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async sendMessage(conversationId: string, dto: CreateMessageDto, senderId: string) {
    await this.assertParticipant(conversationId, senderId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId, content: dto.content },
      select: {
        id: true,
        content: true,
        senderId: true,
        createdAt: true,
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.notifyRecipients(conversationId, senderId);

    return message;
  }

  /**
   * Tells the other participants a message arrived — until now a new
   * message raised no notification at all. One unread notification per
   * conversation and sender is enough: a burst of ten messages should not
   * put ten entries in the bell.
   */
  private async notifyRecipients(conversationId: string, senderId: string) {
    const recipients = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId } },
      select: { userId: true },
    });

    for (const { userId } of recipients) {
      const pending = await this.prisma.notification.findFirst({
        where: { userId, actorId: senderId, type: 'MESSAGE', entityId: conversationId, read: false },
        select: { id: true },
      });
      if (!pending) {
        await this.notifications.create(userId, senderId, 'MESSAGE', conversationId, 'conversation');
      }
    }
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant of this conversation');
  }
}

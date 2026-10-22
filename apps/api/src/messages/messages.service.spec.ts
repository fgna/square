import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  conversation: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversationParticipant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  message: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  notification: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
};

const mockNotifications = { create: vi.fn() };

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a message when user is a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);
      const mockMessage = {
        id: 'm-1',
        content: 'Hello',
        senderId: 'user-1',
        createdAt: new Date(),
        sender: { id: 'user-1', name: 'Alice', avatarUrl: null },
      };
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.sendMessage('conv-1', { content: 'Hello' }, 'user-1');
      expect(result.content).toBe('Hello');
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage('conv-1', { content: 'Hi' }, 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages for a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      const mockMessages = [
        { id: 'm-1', content: 'Hello', senderId: 'user-1', createdAt: new Date(), sender: {} },
      ];
      mockPrisma.message.findMany.mockResolvedValue(mockMessages);
      mockPrisma.message.count.mockResolvedValue(1);
      mockPrisma.conversationParticipant.updateMany.mockResolvedValue({});

      const result = await service.getMessages('conv-1', 'user-1', 1, 50);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('message notifications', () => {
    beforeEach(() => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.message.create.mockResolvedValue({ id: 'm-1' });
      mockPrisma.conversation.update.mockResolvedValue({});
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ userId: 'alice' }]);
    });

    it('notifies the other participant, not the sender', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await service.sendMessage('conv-1', { content: 'Hi' }, 'bob');

      expect(mockPrisma.conversationParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conversationId: 'conv-1', userId: { not: 'bob' } } }),
      );
      expect(mockNotifications.create).toHaveBeenCalledWith('alice', 'bob', 'MESSAGE', 'conv-1', 'conversation');
    });

    it('does not pile up notifications while one is still unread', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'n-1' });

      await service.sendMessage('conv-1', { content: 'Another one' }, 'bob');

      expect(mockNotifications.create).not.toHaveBeenCalled();
    });

    it('marks them read when the conversation is opened', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      await service.getMessages('conv-1', 'alice');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'alice', type: 'MESSAGE', entityId: 'conv-1', read: false },
        data: { read: true },
      });
    });
  });
});

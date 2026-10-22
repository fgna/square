import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ModerationFeedbackService } from './moderation-feedback.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';

describe('ModerationFeedbackService.hideWithFeedback', () => {
  const prisma = {
    post: { findUnique: vi.fn(), update: vi.fn() },
    postReport: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const messages = {
    getOrCreateConversation: vi.fn().mockResolvedValue({ id: 'conv-1' }),
    sendMessage: vi.fn().mockResolvedValue({ id: 'm1' }),
  };
  let service: ModerationFeedbackService;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'alice', content: '<p>Buy my course at example.com</p>' });
    const module = await Test.createTestingModule({
      providers: [
        ModerationFeedbackService,
        { provide: PrismaService, useValue: prisma },
        { provide: MessagesService, useValue: messages },
      ],
    }).compile();
    service = module.get(ModerationFeedbackService);
  });

  it('hides the post, closes its reports and messages the author privately', async () => {
    await service.hideWithFeedback('p1', 'admin-1', 'Please leave out the advertising.');

    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isHidden: true } });
    expect(prisma.postReport.updateMany).toHaveBeenCalled();
    expect(messages.getOrCreateConversation).toHaveBeenCalledWith('admin-1', 'alice');
    const [conversationId, { content }, sender] = messages.sendMessage.mock.calls[0];
    expect(conversationId).toBe('conv-1');
    expect(sender).toBe('admin-1');
    expect(content).toContain('Buy my course at example.com');
    expect(content).toContain('Please leave out the advertising.');
    expect(content).not.toContain('<p>');
  });

  it('refuses a post by the admin themselves', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'admin-1', content: 'x' });
    await expect(service.hideWithFeedback('p1', 'admin-1', 'x')).rejects.toThrow('This is your own post');
    expect(messages.sendMessage).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService — welcome video', () => {
  const prisma = {
    platformSettings: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  };
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(UsersService);
  });

  it('returns the embeddable video and that the member has not hidden it', async () => {
    prisma.platformSettings.findUnique.mockResolvedValue({ welcomeVideoUrl: 'https://www.loom.com/share/0123456789abcdef' });
    prisma.user.findUnique.mockResolvedValue({ welcomeVideoDismissedAt: null });

    await expect(service.getWelcome('u1')).resolves.toEqual({
      videoEmbedUrl: 'https://www.loom.com/embed/0123456789abcdef',
      videoFileUrl: null,
      dismissed: false,
    });
  });

  it('plays an uploaded welcome video from a signed link, never the stored path', async () => {
    prisma.platformSettings.findUnique.mockResolvedValue({ welcomeVideoUrl: '/uploads/videos/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e.mp4' });
    prisma.user.findUnique.mockResolvedValue({ welcomeVideoDismissedAt: null });
    const welcome = await service.getWelcome('u1');
    expect(welcome.videoEmbedUrl).toBeNull();
    expect(welcome.videoFileUrl).toMatch(/\/uploads\/videos\/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e\.mp4\?exp=\d+&sig=[0-9a-f]+$/);
  });

  it('reports no video when none is set', async () => {
    prisma.platformSettings.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ welcomeVideoDismissedAt: new Date() });

    await expect(service.getWelcome('u1')).resolves.toMatchObject({ videoEmbedUrl: null, dismissed: true });
  });

  it('remembers per member that it was hidden', async () => {
    await service.dismissWelcome('u1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { welcomeVideoDismissedAt: expect.any(Date) },
    });
  });
});

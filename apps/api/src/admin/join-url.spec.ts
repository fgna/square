import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin.service';
import { PlatformController } from './platform.controller';

function setup(current: Record<string, unknown> | null = null) {
  const prisma = { platformSettings: {
    findUnique: vi.fn().mockResolvedValue(current),
    upsert: vi.fn().mockImplementation(async ({ update }) => ({ ...current, ...update })),
  } };
  return { prisma, service: new AdminService(prisma as never, {} as never), controller: new PlatformController(prisma as never) };
}

describe('Join page for visitors without an invitation', () => {
  it('stores an https page and shows it in the public branding', async () => {
    const { service, prisma } = setup();
    await service.updatePlatformSettings({ joinUrl: ' https://go.example.com/growthleaders ' });
    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ joinUrl: 'https://go.example.com/growthleaders' }),
    }));
    expect(await setup({ allowSignups: false, joinUrl: 'https://go.example.com/growthleaders' }).controller.branding())
      .toMatchObject({ allowSignups: false, joinUrl: 'https://go.example.com/growthleaders' });
  });

  it('removes it when emptied and refuses anything but https', async () => {
    const empty = setup();
    await empty.service.updatePlatformSettings({ joinUrl: '' });
    expect(empty.prisma.platformSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ joinUrl: null }) }));
    for (const joinUrl of ['http://go.example.com', 'javascript:alert(1)', 'https://user:pw@go.example.com', '/register']) {
      const { service, prisma } = setup();
      await expect(service.updatePlatformSettings({ joinUrl })).rejects.toThrow('Join page must be an https address');
      expect(prisma.platformSettings.upsert).not.toHaveBeenCalled();
    }
  });
});

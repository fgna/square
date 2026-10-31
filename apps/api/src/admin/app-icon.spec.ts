import { describe, it, expect, vi } from 'vitest';
import { AdminService, isOwnUploadPath } from './admin.service';
import { PlatformController } from './platform.controller';

function setup(current: Record<string, unknown> | null = null) {
  const prisma = { platformSettings: {
    findUnique: vi.fn().mockResolvedValue(current),
    upsert: vi.fn().mockImplementation(async ({ update }) => ({ ...current, ...update })),
  } };
  return { prisma, service: new AdminService(prisma as never, {} as never),
    controller: new PlatformController(prisma as never) };
}

describe('App icon setting', () => {
  it('stores an own upload and exposes it through public branding', async () => {
    const { service, prisma } = setup();
    await service.updatePlatformSettings({ appIconUrl: ' /uploads/uploads/u1/icon.png ' });
    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ appIconUrl: '/uploads/uploads/u1/icon.png' }),
    }));
    const branding = await setup({ platformName: 'GrowthLeaders', appIconUrl: '/uploads/uploads/u1/icon.png' }).controller.branding();
    expect(branding).toMatchObject({ platformName: 'GrowthLeaders', appIconUrl: '/uploads/uploads/u1/icon.png' });
  });

  it('removes the icon when emptied', async () => {
    const { service, prisma } = setup();
    await service.updatePlatformSettings({ appIconUrl: '' });
    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ appIconUrl: null }),
    }));
    expect(await setup(null).controller.branding()).toMatchObject({ appIconUrl: null });
  });

  it('refuses anything but an own upload before writing', async () => {
    for (const appIconUrl of ['https://example.com/icon.png', '//example.com/x.png', '/uploads/../etc/passwd',
      '/api/users', '/uploads/a.png?x=1', '/uploads/a b.png', 'javascript:alert(1)']) {
      const { service, prisma } = setup();
      await expect(service.updatePlatformSettings({ appIconUrl })).rejects.toThrow('App icon must be an uploaded image');
      expect(prisma.platformSettings.upsert).not.toHaveBeenCalled();
    }
    expect(isOwnUploadPath('/uploads/uploads/u1/b9-icon.png')).toBe(true);
  });
});

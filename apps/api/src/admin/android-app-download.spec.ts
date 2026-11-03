import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin.service';
import { PlatformController } from './platform.controller';
import { AdminController } from './admin.controller';

const url = 'https://downloads.example.com/community.apk';

function setup(current: Record<string, unknown> | null = null) {
  const prisma = { platformSettings: {
    findUnique: vi.fn().mockResolvedValue(current),
    upsert: vi.fn().mockImplementation(async ({ update }) => ({ ...current, ...update })),
  } };
  return { prisma, service: new AdminService(prisma as never, {} as never),
    controller: new PlatformController(prisma as never) };
}

describe('Android app download settings', () => {
  it('keeps settings writes under the existing admin-only role boundary', () => {
    expect(Reflect.getMetadata('roles', AdminController)).toEqual(['ADMIN']);
  });

  it('persists the normalized URL and enabled flag together', async () => {
    const { service, prisma } = setup();
    await service.updatePlatformSettings({ androidAppDownloadEnabled: true, androidAppDownloadUrl: ` ${url} ` });
    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ androidAppDownloadEnabled: true, androidAppDownloadUrl: url }),
      update: expect.objectContaining({ androidAppDownloadEnabled: true, androidAppDownloadUrl: url }),
    }));
  });

  it('enables a saved URL and supports disabling without deleting it', async () => {
    const { service } = setup({ androidAppDownloadUrl: url, androidAppDownloadEnabled: false });
    expect(await service.updatePlatformSettings({ androidAppDownloadEnabled: true }))
      .toMatchObject({ androidAppDownloadEnabled: true, androidAppDownloadUrl: url });
    const enabled = setup({ androidAppDownloadUrl: url, androidAppDownloadEnabled: true });
    expect(await enabled.service.updatePlatformSettings({ androidAppDownloadEnabled: false }))
      .toMatchObject({ androidAppDownloadEnabled: false, androidAppDownloadUrl: url });
  });

  it('rejects invalid or missing links before writing to the database', async () => {
    for (const androidAppDownloadUrl of [null, '', 'http://example.com/app', 'https://token@example.com/app']) {
      const { service, prisma } = setup();
      await expect(service.updatePlatformSettings({ androidAppDownloadEnabled: true, androidAppDownloadUrl }))
        .rejects.toThrow();
      expect(prisma.platformSettings.upsert).not.toHaveBeenCalled();
    }
  });

  it('does not read download state for unrelated settings changes', async () => {
    const { service, prisma } = setup();
    await service.updatePlatformSettings({ platformName: 'Example' });
    expect(prisma.platformSettings.findUnique).not.toHaveBeenCalled();
  });

  it('exposes only enabled and valid URLs through public branding', async () => {
    const current = { platformName: 'Example', allowSignups: true, logoUrl: null,
      androidAppDownloadUrl: url, androidAppDownloadEnabled: true };
    expect(await setup(current).controller.branding()).toMatchObject({
      androidAppDownloadEnabled: true, androidAppDownloadUrl: url,
    });
    for (const state of [null, { ...current, androidAppDownloadEnabled: false },
      { ...current, androidAppDownloadUrl: 'javascript:bad' }]) {
      expect(await setup(state).controller.branding()).toMatchObject({
        androidAppDownloadEnabled: false, androidAppDownloadUrl: null,
      });
    }
  });
});

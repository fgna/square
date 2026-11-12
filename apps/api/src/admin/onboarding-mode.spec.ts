import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformController } from './platform.controller';
import type { PrismaService } from '../prisma/prisma.service';

describe('community onboarding mode API', () => {
  it.each(['REQUIRED', 'OPTIONAL', 'DISABLED'] as const)('accepts %s for admin settings', async mode => {
    const dto = Object.assign(new UpdatePlatformSettingsDto(), { onboardingMode: mode });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects an unknown onboarding mode', async () => {
    const dto = Object.assign(new UpdatePlatformSettingsDto(), { onboardingMode: 'BYPASS' });
    expect((await validate(dto)).some(error => error.property === 'onboardingMode')).toBe(true);
  });

  it('exposes the mode in public branding without changing other branding fields', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      platformName: 'Test Community',
      logoUrl: null,
      appIconUrl: null,
      allowSignups: false,
      joinUrl: null,
      privacyNoticeEnabled: true,
      onboardingMode: 'OPTIONAL',
      androidAppDownloadEnabled: false,
      androidAppDownloadUrl: null,
    });
    const controller = new PlatformController({ platformSettings: { findUnique } } as unknown as PrismaService);
    const branding = await controller.branding();
    expect(branding).toMatchObject({
      platformName: 'Test Community',
      allowSignups: false,
      privacyNoticeEnabled: true,
      onboardingMode: 'OPTIONAL',
    });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'default' },
      select: expect.objectContaining({ onboardingMode: true }),
    }));
  });

  it('defaults missing community settings to REQUIRED for existing instances', async () => {
    const controller = new PlatformController({
      platformSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);
    expect((await controller.branding()).onboardingMode).toBe('REQUIRED');
  });
});

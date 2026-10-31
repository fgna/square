import { Controller, Get, SetMetadata } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { androidAppDownloadUrl } from '@community/shared/android-app-download';

/**
 * Name, logo and app icon of the platform, for the sidebar, the sign-in page
 * and the home-screen icon, and whether anyone may sign up (the registration
 * page shows a notice instead of the form when not). Public because the sign-in page is shown before anyone
 * is signed in; it exposes nothing beyond what those pages display.
 */
@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private prisma: PrismaService) {}

  @Get('branding')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @ApiOperation({ summary: 'Platform name, logo, app icon and whether sign-ups are open' })
  async branding() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { platformName: true, logoUrl: true, appIconUrl: true, allowSignups: true, joinUrl: true,
        androidAppDownloadEnabled: true, androidAppDownloadUrl: true },
    });
    return {
      platformName: settings?.platformName ?? 'Community',
      logoUrl: settings?.logoUrl ?? null,
      appIconUrl: settings?.appIconUrl ?? null,
      allowSignups: settings?.allowSignups ?? true,
      joinUrl: settings?.joinUrl ?? null,
      androidAppDownloadEnabled: androidAppDownloadUrl(settings) !== null,
      androidAppDownloadUrl: androidAppDownloadUrl(settings),
    };
  }
}

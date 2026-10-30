import { Controller, Get, SetMetadata } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { androidAppDownloadUrl } from '@community/shared/android-app-download';

/**
 * Name and logo of the platform, for the sidebar and the sign-in page, and
 * whether anyone may sign up (the registration page shows a notice instead of
 * the form when not). Public because the sign-in page is shown before anyone
 * is signed in; it exposes nothing beyond what those pages display.
 */
@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private prisma: PrismaService) {}

  @Get('branding')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @ApiOperation({ summary: 'Platform name, logo and whether sign-ups are open' })
  async branding() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { platformName: true, logoUrl: true, allowSignups: true,
        androidAppDownloadEnabled: true, androidAppDownloadUrl: true },
    });
    return {
      platformName: settings?.platformName ?? 'Community',
      logoUrl: settings?.logoUrl ?? null,
      allowSignups: settings?.allowSignups ?? true,
      androidAppDownloadEnabled: androidAppDownloadUrl(settings) !== null,
      androidAppDownloadUrl: androidAppDownloadUrl(settings),
    };
  }
}

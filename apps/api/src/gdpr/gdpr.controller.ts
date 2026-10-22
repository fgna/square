import { Controller, Get, Post, Delete, Body, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GdprService } from './gdpr.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';

@ApiTags('gdpr')
@Controller('gdpr')
export class GdprController {
  constructor(private gdprService: GdprService) {}

  @Get('consent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user cookie consent' })
  getConsent(@CurrentUser() user: any) {
    return this.gdprService.getConsent(user.id);
  }

  @Post('consent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update cookie consent' })
  updateConsent(@CurrentUser() user: any, @Body() body: { analytics: boolean; marketing: boolean }) {
    return this.gdprService.updateConsent(user.id, body.analytics, body.marketing);
  }

  @Post('consent/anonymous')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @ApiOperation({ summary: 'Save anonymous cookie consent' })
  saveAnonymousConsent(@Body() body: { sessionId: string; analytics: boolean; marketing: boolean }) {
    return this.gdprService.saveAnonymousConsent(body.sessionId, body.analytics, body.marketing);
  }

  @Get('export')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Export user data (GDPR Article 20)' })
  exportData(@CurrentUser() user: any) {
    return this.gdprService.exportUserData(user.id);
  }

  @Delete('account')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete account (GDPR Article 17)' })
  deleteAccount(@CurrentUser() user: any) {
    return this.gdprService.deleteAccount(user.id);
  }

  @Get('privacy-settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get privacy settings' })
  getPrivacySettings(@CurrentUser() user: any) {
    return this.gdprService.getPrivacySettings(user.id);
  }
}

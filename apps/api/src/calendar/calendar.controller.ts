import { Controller, Get, Post, Delete, Param, Res, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  private feedUrl(token: string): string {
    const base = process.env.API_URL || 'http://localhost:3001';
    return `${base}/api/calendar/${token}/feed.ics`;
  }

  @Get('subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get (and create on first call) the personal calendar feed URL' })
  async getSubscription(@CurrentUser() user: any) {
    const token = await this.calendarService.getOrCreateToken(user.id);
    const url = this.feedUrl(token);
    return {
      url,
      // webcal:// makes the OS hand the link to the calendar app instead of
      // downloading a one-off copy, which is what makes cancellations work.
      webcalUrl: url.replace(/^https?:\/\//, 'webcal://'),
    };
  }

  @Post('subscription/regenerate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue a new feed URL and invalidate the old one' })
  async regenerate(@CurrentUser() user: any) {
    const token = await this.calendarService.regenerateToken(user.id);
    const url = this.feedUrl(token);
    return { url, webcalUrl: url.replace(/^https?:\/\//, 'webcal://') };
  }

  @Delete('subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable the personal calendar feed' })
  revoke(@CurrentUser() user: any) {
    return this.calendarService.revokeToken(user.id);
  }

  // Calendar clients cannot send an Authorization header, so the token in the
  // path is the credential. Excluded from Swagger to keep it out of the docs.
  @Get(':token/feed.ics')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @ApiExcludeEndpoint()
  async feed(@Param('token') token: string, @Res() res: Response) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const ics = await this.calendarService.getFeedByToken(token, appUrl);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="community-events.ics"');
    // A stale feed would keep showing cancelled events.
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.send(ics);
  }
}

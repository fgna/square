import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request, Res, HttpCode, HttpStatus, SetMetadata, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { IS_PUBLIC_KEY } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private oauthService: OAuthService,
  ) {}

  private getFingerprint(@Request() req: any): string | undefined {
    const userAgent = req.headers?.['user-agent'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!userAgent && !ip) return undefined;
    return AuthService.computeFingerprint(userAgent, ip);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }

  @Post('register')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @Throttle({ auth: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Request() req: any,
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, this.getFingerprint(req));
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Post('login')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Request() req: any,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.getFingerprint(req));
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Post('refresh')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 30, ttl: 900_000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken: string = req.user.refreshToken;
    const result = await this.authService.refresh(
      req.user.id,
      req.user.email,
      req.user.role,
      oldRefreshToken,
      this.getFingerprint(req),
    );
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Post('logout')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(
    @Request() req: any,
    @Body('refreshToken') bodyToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Accept token from cookie (primary) or body (fallback for API clients)
    const refreshToken: string | undefined =
      req.cookies?.[REFRESH_COOKIE] || bodyToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }

  @Post('oauth/google')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Login or register via Google OAuth' })
  async oauthGoogle(
    @Request() req: any,
    @Body() dto: OAuthCallbackDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.oauthService.handleGoogleCallback(dto.code, dto.redirectUri, this.getFingerprint(req));
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Post('oauth/linkedin')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Login or register via LinkedIn OAuth' })
  async oauthLinkedIn(
    @Request() req: any,
    @Body() dto: OAuthCallbackDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.oauthService.handleLinkedInCallback(dto.code, dto.redirectUri, this.getFingerprint(req));
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  @Get('oauth/accounts')
  @ApiOperation({ summary: 'List linked OAuth accounts' })
  async getOAuthAccounts(@CurrentUser() user: any) {
    return this.oauthService.getLinkedAccounts(user.id);
  }

  @Post('oauth/link/:provider')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Link an OAuth provider to your account' })
  async linkOAuth(@CurrentUser() user: any, @Param('provider') provider: string, @Body() dto: OAuthCallbackDto) {
    return this.oauthService.linkProvider(user.id, provider, dto.code, dto.redirectUri);
  }

  @Delete('oauth/unlink/:provider')
  @ApiOperation({ summary: 'Unlink an OAuth provider from your account' })
  async unlinkOAuth(@CurrentUser() user: any, @Param('provider') provider: string) {
    return this.oauthService.unlinkProvider(user.id, provider);
  }
}

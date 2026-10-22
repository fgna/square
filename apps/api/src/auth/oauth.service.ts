import { Injectable, BadRequestException, ForbiddenException, UnauthorizedException, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

interface OAuthUserInfo {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async handleGoogleCallback(code: string, redirectUri: string, fingerprint?: string) {
    this.requireGoogleConfig();
    const tokens = await this.exchangeGoogleCode(code, redirectUri);
    const userInfo = await this.getGoogleUserInfo(tokens.access_token);
    return this.handleOAuthLogin('google', userInfo, fingerprint);
  }

  async handleLinkedInCallback(code: string, redirectUri: string, fingerprint?: string) {
    this.requireLinkedInConfig();
    const tokens = await this.exchangeLinkedInCode(code, redirectUri);
    const userInfo = await this.getLinkedInUserInfo(tokens.access_token);
    return this.handleOAuthLogin('linkedin', userInfo, fingerprint);
  }

  async getLinkedAccounts(userId: string) {
    return this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: { id: true, provider: true, email: true, createdAt: true },
    });
  }

  async linkProvider(userId: string, provider: string, code: string, redirectUri: string) {
    let userInfo: OAuthUserInfo;
    if (provider === 'google') {
      this.requireGoogleConfig();
      const tokens = await this.exchangeGoogleCode(code, redirectUri);
      userInfo = await this.getGoogleUserInfo(tokens.access_token);
    } else if (provider === 'linkedin') {
      this.requireLinkedInConfig();
      const tokens = await this.exchangeLinkedInCode(code, redirectUri);
      userInfo = await this.getLinkedInUserInfo(tokens.access_token);
    } else {
      throw new BadRequestException('Unsupported provider');
    }

    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: userInfo.providerAccountId } },
    });
    if (existing) {
      if (existing.userId === userId) return { message: 'Already linked' };
      throw new BadRequestException('This account is already linked to another user');
    }

    await this.prisma.oAuthAccount.create({
      data: {
        provider,
        providerAccountId: userInfo.providerAccountId,
        email: userInfo.email,
        userId,
      },
    });

    return { message: `${provider} account linked` };
  }

  async unlinkProvider(userId: string, provider: string) {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider },
    });
    if (!account) {
      throw new BadRequestException('Provider not linked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const otherOAuth = await this.prisma.oAuthAccount.count({
      where: { userId, provider: { not: provider } },
    });

    if (!user?.passwordHash && otherOAuth === 0) {
      throw new BadRequestException('Cannot unlink — you need at least one sign-in method. Set a password first.');
    }

    await this.prisma.oAuthAccount.delete({ where: { id: account.id } });
    return { message: `${provider} account unlinked` };
  }

  private async handleOAuthLogin(provider: string, userInfo: OAuthUserInfo, fingerprint?: string) {
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: userInfo.providerAccountId } },
      include: { user: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, membershipTier: true, isActive: true } } },
    });

    if (existing) {
      if (!existing.user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
      const tokens = await this.authService.generateTokens(existing.user.id, existing.user.email, existing.user.role, fingerprint);
      const { isActive: _, ...user } = existing.user;
      return { user, ...tokens };
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: userInfo.email.toLowerCase().trim() },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, membershipTier: true, isActive: true },
    });

    if (existingUser) {
      if (!userInfo.emailVerified) {
        throw new BadRequestException('Cannot link account: email not verified by provider');
      }
      if (!existingUser.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
      await this.prisma.oAuthAccount.create({
        data: {
          provider,
          providerAccountId: userInfo.providerAccountId,
          email: userInfo.email,
          userId: existingUser.id,
        },
      });
      const tokens = await this.authService.generateTokens(existingUser.id, existingUser.email, existingUser.role, fingerprint);
      const { isActive: _, ...user } = existingUser;
      return { user, ...tokens };
    }

    if (!(await this.authService.signupsAllowed())) {
      throw new ForbiddenException('Registration is by invitation only');
    }

    const newUser = await this.prisma.user.create({
      data: {
        email: userInfo.email.toLowerCase().trim(),
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl,
        oauthAccounts: {
          create: {
            provider,
            providerAccountId: userInfo.providerAccountId,
            email: userInfo.email,
          },
        },
      },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, membershipTier: true, createdAt: true },
    });

    const tokens = await this.authService.generateTokens(newUser.id, newUser.email, newUser.role, fingerprint);
    return { user: newUser, ...tokens };
  }

  private async exchangeGoogleCode(code: string, redirectUri: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      throw new BadRequestException('Failed to exchange Google authorization code');
    }
    return res.json() as Promise<{ access_token: string }>;
  }

  private async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new BadRequestException('Failed to fetch Google user info');
    const data = await res.json() as { id: string; email: string; name: string; picture?: string; verified_email?: boolean };
    if (!data.email) throw new BadRequestException('Google account has no email');
    return { providerAccountId: data.id, email: data.email, emailVerified: data.verified_email === true, name: data.name, avatarUrl: data.picture };
  }

  private async exchangeLinkedInCode(code: string, redirectUri: string) {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new BadRequestException('Failed to exchange LinkedIn authorization code');
    return res.json() as Promise<{ access_token: string }>;
  }

  private async getLinkedInUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new BadRequestException('Failed to fetch LinkedIn user info');
    const data = await res.json() as { sub: string; email: string; name: string; picture?: string; email_verified?: boolean };
    if (!data.email) throw new BadRequestException('LinkedIn account has no email');
    return { providerAccountId: data.sub, email: data.email, emailVerified: data.email_verified === true, name: data.name, avatarUrl: data.picture };
  }

  private requireGoogleConfig() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new NotImplementedException('Google OAuth is not configured');
    }
  }

  private requireLinkedInConfig() {
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      throw new NotImplementedException('LinkedIn OAuth is not configured');
    }
  }
}

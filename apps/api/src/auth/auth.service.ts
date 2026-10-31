import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { InvitesService } from '../invites/invites.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { REDIS_CLIENT } from '../redis/redis.module';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import type Redis from 'ioredis';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS = 10;
  private readonly LOGIN_ATTEMPT_WINDOW_SECS = 15 * 60;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private invitesService: InvitesService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  static computeFingerprint(userAgent: string, ip: string): string {
    return createHash('sha256').update(`${userAgent}|${ip}`).digest('hex');
  }

  /**
   * Admin → Settings → "Allow sign-ups". When it is off, new accounts need an
   * invitation; this applies to e-mail registration and to Google/LinkedIn.
   */
  async signupsAllowed(): Promise<boolean> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { allowSignups: true },
    });
    return settings?.allowSignups ?? true;
  }

  async register(dto: RegisterDto, fingerprint?: string) {
    const email = dto.email.toLowerCase().trim();

    if (!dto.inviteToken && !(await this.signupsAllowed())) {
      throw new ForbiddenException('Registration is by invitation only');
    }

    if (dto.inviteToken) {
      const invite = await this.invitesService.validateInvite(dto.inviteToken);
      if (invite.email.toLowerCase().trim() !== email) {
        throw new BadRequestException('Invite was issued for a different email address');
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      // Return generic message to prevent email enumeration
      throw new ConflictException('Registration failed — please check your details or try again later');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        membershipTier: true,
        createdAt: true,
      },
    });

    if (dto.inviteToken) {
      await this.invitesService.consumeInvite(dto.inviteToken);
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role, fingerprint);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto, fingerprint?: string) {
    const email = dto.email.toLowerCase().trim();

    await this.checkLoginAttempts(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearLoginAttempts(email);

    const tokens = await this.generateTokens(user.id, user.email, user.role, fingerprint);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        membershipTier: user.membershipTier,
      },
      ...tokens,
    };
  }

  private async checkLoginAttempts(email: string): Promise<void> {
    try {
      const val = await this.redis.get(`login_attempts:${email}`);
      if (val && parseInt(val, 10) >= this.MAX_LOGIN_ATTEMPTS) {
        throw new UnauthorizedException('Too many login attempts. Please try again later.');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`Redis unavailable — brute-force check skipped: ${(err as Error).message}`);
    }
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    try {
      const key = `login_attempts:${email}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, this.LOGIN_ATTEMPT_WINDOW_SECS);
      }
    } catch (err) {
      this.logger.warn(`Redis unavailable — attempt not recorded: ${(err as Error).message}`);
    }
  }

  private async clearLoginAttempts(email: string): Promise<void> {
    try {
      await this.redis.del(`login_attempts:${email}`);
    } catch (err) {
      this.logger.warn(`Redis unavailable — attempts not cleared: ${(err as Error).message}`);
    }
  }

  async refresh(userId: string, email: string, role: string, oldRefreshToken: string, fingerprint?: string) {
    const deleted = await this.prisma.refreshToken.deleteMany({
      where: { token: oldRefreshToken },
    });

    // If the token was already consumed by a concurrent request, reject to prevent ghost sessions.
    if (deleted.count === 0) {
      throw new UnauthorizedException('Refresh token already used or revoked');
    }

    return this.generateTokens(userId, email, role, fingerprint);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    return { message: 'Logged out successfully' };
  }

  async generateTokens(userId: string, email: string, role: string, fingerprint?: string) {
    // Bind short-lived access tokens to the current password hash so password
    // recovery invalidates already issued access tokens immediately.
    const authUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    const payload = { sub: userId, email, role, pwdv: createHash('sha256').update(authUser?.passwordHash || '').digest('hex') };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      secret: process.env.JWT_SECRET,
    });

    // jti (JWT ID) makes every refresh token unique even when signed within
    // the same second for the same user, preventing DB unique-constraint
    // collisions and enabling per-token revocation.
    // fhp (fingerprint hash) binds the token to a specific client, preventing
    // token replay from different browsers or IPs.
    const refreshPayload: Record<string, any> = { ...payload, jti: uuidv4() };
    if (fingerprint) {
      refreshPayload.fhp = fingerprint;
    }
    const refreshToken = this.jwtService.sign(
      refreshPayload,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );

    // Purge expired tokens for this user to prevent unbounded token storage.
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}

import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import * as argon2 from 'argon2';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

const TTL_SECONDS = 20 * 60;
const CONFIRMATION = { message: 'If an eligible account exists, a password reset email will be sent.' };
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async request(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    // Recovery cannot be enabled without both working email transport and a
    // configured, trusted public origin. Never derive URLs from Host headers.
    const origin = process.env.PUBLIC_BASE_URL;
    if (!this.email.isConfigured || !origin) return CONFIRMATION;
    let baseUrl: URL;
    try {
      baseUrl = new URL(origin);
      if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || baseUrl.pathname !== '/') {
        return CONFIRMATION;
      }
    } catch { return CONFIRMATION; }

    // Fail closed if Redis is unavailable: no unthrottled reset email flood.
    try {
      const key = 'password-reset:request:' + hashToken(email);
      if (await this.redis.set(key, '1', 'EX', 60, 'NX') !== 'OK') return CONFIRMATION;
      const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true, passwordHash: true } });
      if (!user?.isActive || !user.passwordHash) return CONFIRMATION;
      const token = randomBytes(32).toString('hex');
      const tokenKey = 'password-reset:token:' + hashToken(token);
      await this.redis.set(tokenKey, user.id, 'EX', TTL_SECONDS);
      const link = new URL('/reset-password', baseUrl);
      link.searchParams.set('token', token);
      const delivered = await this.email.send({
        to: email,
        subject: 'Reset your password',
        html: '<p>Use this link to reset your password. It expires in 20 minutes.</p><p><a href="' + link.toString().replace(/&/g, '&amp;') + '">Reset password</a></p><p>If you did not request this, ignore this email.</p>',
      });
      if (!delivered) {
        await this.redis.del(tokenKey);
        this.logger.warn('Password recovery delivery failed');
      }
    } catch {
      this.logger.warn('Password recovery request unavailable');
    }
    return CONFIRMATION;
  }

  async reset(token: string, password: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException('Invalid or expired reset link');
    if (password.length < 8 || password.length > 128) throw new BadRequestException('Invalid password length');
    // GETDEL is atomic: at most one request can consume a token.
    let userId: string | null;
    try {
      userId = await this.redis.call('GETDEL', 'password-reset:token:' + hashToken(token)) as string | null;
    } catch {
      throw new ServiceUnavailableException('Password reset temporarily unavailable');
    }
    if (!userId) throw new BadRequestException('Invalid or expired reset link');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user?.isActive) throw new BadRequestException('Invalid or expired reset link');
    const passwordHash = await argon2.hash(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    return { message: 'Password updated. Please sign in again.' };
  }
}

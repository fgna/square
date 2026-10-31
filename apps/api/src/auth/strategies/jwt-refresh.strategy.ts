import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Primary: httpOnly cookie (set by login/refresh endpoints)
        (req) => req?.cookies?.refresh_token ?? null,
        // Fallback: body field for API clients and Android native
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.replacedBy) {
      // Legacy refresh JWTs without a client fingerprint may rotate once,
      // but cannot use the retry grace from an unbound client.
      if (!payload.fhp) {
        throw new UnauthorizedException('Unbound refresh token cannot be retried');
      }
      const age = storedToken.rotatedAt
        ? Date.now() - storedToken.rotatedAt.getTime()
        : Infinity;
      const successor = await this.prisma.refreshToken.findUnique({
        where: { token: storedToken.replacedBy },
      });
      if (age < 0 || age > 20_000 || !successor ||
          successor.userId !== storedToken.userId || successor.expiresAt <= new Date()) {
        throw new UnauthorizedException('Refresh token already used or revoked');
      }
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    // Validate fingerprint if the token was issued with one
    if (payload.fhp) {
      const userAgent = req.headers?.['user-agent'] || '';
      const ip = req.ip || req.connection?.remoteAddress || '';
      const currentFhp = AuthService.computeFingerprint(userAgent, ip);
      if (currentFhp !== payload.fhp) {
        // Fingerprint mismatch — revoke the token to prevent replay
        // Revoke the active successor too if a rotated token is replayed
        // from another fingerprint during the grace window.
        let current: string | null = refreshToken;
        for (let i = 0; current && i < 100; i++) {
          const row = await this.prisma.refreshToken.findUnique({ where: { token: current } });
          if (!row) break;
          await this.prisma.refreshToken.deleteMany({ where: { token: current } });
          current = row.replacedBy;
        }
        throw new UnauthorizedException('Token fingerprint mismatch — session invalidated');
      }
    }

    return { ...storedToken.user, refreshToken };
  }
}

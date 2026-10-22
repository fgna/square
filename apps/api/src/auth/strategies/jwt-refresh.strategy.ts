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
        await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
        throw new UnauthorizedException('Token fingerprint mismatch — session invalidated');
      }
    }

    return { ...storedToken.user, refreshToken };
  }
}

import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

const jwt = new JwtService({});

/**
 * Uses authenticated userId as the throttle key so rate limits apply
 * per user rather than per IP (important behind reverse proxies).
 * Token refresh runs before any user is known; a validly signed refresh
 * cookie still names its user, so members behind one proxy address (or
 * reloading pages often) do not share one refresh budget. Anything else
 * falls back to IP (login, register, forged cookies).
 *
 * Set THROTTLE_DISABLE=true to bypass all throttling (integration tests).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.THROTTLE_DISABLE === 'true') return true;
    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id ?? refreshTokenUser(req) ?? req.ip ?? 'unknown';
  }
}

function refreshTokenUser(req: Record<string, any>): string | undefined {
  const token = req.cookies?.refresh_token;
  if (typeof token !== 'string' || token === '') return undefined;
  try {
    const payload = jwt.verify(token, { secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret' });
    return typeof payload?.sub === 'string' ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

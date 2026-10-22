import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Uses authenticated userId as the throttle key so rate limits apply
 * per user rather than per IP (important behind reverse proxies).
 * Falls back to IP for unauthenticated requests (login, register).
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
    return req.user?.id ?? req.ip ?? 'unknown';
  }
}

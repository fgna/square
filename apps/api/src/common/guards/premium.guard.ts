import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PremiumGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (user.membershipTier === 'FREE' && user.role !== 'ADMIN') {
      throw new ForbiddenException('This feature requires a Premium membership');
    }

    return true;
  }
}

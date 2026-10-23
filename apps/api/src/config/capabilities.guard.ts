import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { disabledApiCapability, instanceCapabilities } from './capabilities';

/** Enforced before controller handlers, including direct HTTP/API access. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ originalUrl?: string; url: string }>();
    const disabled = disabledApiCapability(req.originalUrl ?? req.url, instanceCapabilities);
    if (disabled) throw new NotFoundException('Capability unavailable');
    return true;
  }
}

import { UseGuards, applyDecorators } from '@nestjs/common';
import { PremiumGuard } from '../guards/premium.guard';

export function RequirePremium() {
  return applyDecorators(UseGuards(PremiumGuard));
}

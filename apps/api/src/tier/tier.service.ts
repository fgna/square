import { Injectable, NotFoundException, BadRequestException, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FREE_TIER_LIMITS, PREMIUM_TIER_LIMITS } from '../common/guards/premium-features';

const VALID_TIERS = ['FREE', 'PREMIUM'] as const;

@Injectable()
export class TierService {
  constructor(private prisma: PrismaService) {}

  async getTierInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, membershipTier: true, role: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const isPremium = user.membershipTier === 'PREMIUM' || user.role === 'ADMIN';
    const limits = isPremium ? PREMIUM_TIER_LIMITS : FREE_TIER_LIMITS;

    return {
      tier: user.membershipTier,
      isPremium,
      limits,
    };
  }

  async upgradeTier(userId: string) {
    // SEC-031: Self-upgrade disabled until billing/payment integration is complete
    throw new NotImplementedException(
      'Self-service tier upgrade is not available. Please contact an administrator.',
    );
  }

  async downgradeTier(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { membershipTier: 'FREE' as any },
      select: { id: true, membershipTier: true },
    });
  }

  async setTier(userId: string, tier: string) {
    // SEC-032: Validate tier against allowed enum values
    if (!VALID_TIERS.includes(tier as any)) {
      throw new BadRequestException(
        `Invalid tier "${tier}". Allowed values: ${VALID_TIERS.join(', ')}`,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { membershipTier: tier as any },
      select: { id: true, membershipTier: true },
    });
  }
}

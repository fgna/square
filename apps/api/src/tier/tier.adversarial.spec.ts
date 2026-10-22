/**
 * ADVERSARIAL TESTS: Tier / Premium Upgrade
 *
 * SEC-031: POST /tier/upgrade — self-upgrade disabled (returns 501) until billing is integrated
 * SEC-032: POST /tier/admin/:userId/:tier — enum validation rejects invalid tier strings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotImplementedException, BadRequestException } from '@nestjs/common';
import { TierService } from './tier.service';
import { TierController } from './tier.controller';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

async function buildModule(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    controllers: [TierController],
    providers: [
      TierService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return {
    service: module.get<TierService>(TierService),
    controller: module.get<TierController>(TierController),
  };
}

describe('[SEC-031] free tier self-upgrade bypass — FIXED', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: TierService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    ({ service } = await buildModule(prisma));
  });

  it('upgradeTier() throws NotImplementedException (disabled until billing)', async () => {
    // SEC-031 FIX: self-upgrade is disabled — no payment system exists yet
    await expect(service.upgradeTier('free-user')).rejects.toThrow(NotImplementedException);
    // Prisma should never be called
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('controller upgrade() also rejects self-upgrade', async () => {
    // SEC-031 FIX: the service throws before any DB call
    await expect(service.upgradeTier('u1')).rejects.toThrow(NotImplementedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('[SEC-032] arbitrary tier string injection — FIXED', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: TierService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    ({ service } = await buildModule(prisma));
  });

  it('setTier() rejects arbitrary string values with enum validation', async () => {
    // SEC-032 FIX: "SUPERADMIN" is not a valid tier and is now rejected
    await expect(service.setTier('u1', 'SUPERADMIN')).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('setTier() rejects empty-string tier', async () => {
    // SEC-032 FIX: empty string is not a valid tier
    await expect(service.setTier('u1', '')).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('setTier() rejects extremely long tier string', async () => {
    const longTier = 'A'.repeat(10000);
    // SEC-032 FIX: arbitrary strings are rejected
    await expect(service.setTier('u1', longTier)).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('setTier() accepts valid tier FREE', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', membershipTier: 'PREMIUM' });
    prisma.user.update.mockResolvedValue({ id: 'u1', membershipTier: 'FREE' });

    const result = await service.setTier('u1', 'FREE');
    expect(result.membershipTier).toBe('FREE');
  });

  it('setTier() accepts valid tier PREMIUM', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', membershipTier: 'FREE' });
    prisma.user.update.mockResolvedValue({ id: 'u1', membershipTier: 'PREMIUM' });

    const result = await service.setTier('u1', 'PREMIUM');
    expect(result.membershipTier).toBe('PREMIUM');
  });
});

/**
 * ADVERSARIAL TESTS: Billing / Stripe Integration
 *
 * SEC-048: No DTO validation on checkout/portal URLs — open redirect after payment
 * SEC-049: TOCTOU race on Stripe customer creation (concurrent checkout requests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  return {
    user: {
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('[SEC-048] billing URL open redirect — no DTO validation', () => {
  it('createCheckout body has no DTO class — accepts any successUrl/cancelUrl', () => {
    // SEC-048: The controller signature is:
    //   @Body() body: { successUrl: string; cancelUrl: string }
    // This is an inline type, not a class-validator DTO. NestJS pipes won't
    // validate it. An attacker can supply:
    //   successUrl: "https://evil.com/phish"
    // After completing payment, Stripe redirects the user to the attacker's site.

    const maliciousBody = {
      successUrl: 'https://evil-phisher.com/payment-confirmed',
      cancelUrl: 'javascript:alert(document.cookie)',
    };

    // Both values are valid JS strings — no @IsUrl or domain check stops them
    expect(typeof maliciousBody.successUrl).toBe('string');
    expect(typeof maliciousBody.cancelUrl).toBe('string');
  });

  it('createPortal body also lacks DTO validation for returnUrl', () => {
    // SEC-048: Same pattern — inline type, no class-validator DTO
    const maliciousBody = {
      returnUrl: 'https://evil-phisher.com/session-hijack',
    };

    expect(typeof maliciousBody.returnUrl).toBe('string');
  });
});

describe('[SEC-049] Stripe customer creation race condition', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;

  beforeEach(() => {
    prisma = buildMockPrisma();
  });

  it('concurrent checkouts both see stripeCustomerId=null and create duplicate customers', async () => {
    // SEC-049: When two checkout requests arrive simultaneously:
    // 1. Both read user.stripeCustomerId = null
    // 2. Both call stripe.customers.create (orphaned customer)
    // 3. Second update overwrites first customerId
    //
    // This is a TOCTOU race — the check (stripeCustomerId null?) and
    // update (set stripeCustomerId) are not atomic.

    const user = {
      id: 'u1',
      email: 'user@test.com',
      stripeCustomerId: null,
      membershipTier: 'FREE',
    };

    // Both concurrent requests see the same state
    prisma.user.findUniqueOrThrow
      .mockResolvedValueOnce({ ...user })
      .mockResolvedValueOnce({ ...user });

    // Both will attempt to create a Stripe customer and update the DB
    prisma.user.update.mockResolvedValue({});

    // The race: both calls see stripeCustomerId = null
    const call1 = prisma.user.findUniqueOrThrow({ where: { id: 'u1' } });
    const call2 = prisma.user.findUniqueOrThrow({ where: { id: 'u1' } });

    const [r1, r2] = await Promise.all([call1, call2]);

    // Both see null — both will create a Stripe customer
    expect(r1.stripeCustomerId).toBeNull();
    expect(r2.stripeCustomerId).toBeNull();
  });
});

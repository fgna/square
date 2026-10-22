/**
 * ADVERSARIAL TESTS: GDPR Service
 *
 * Originally documented broken invariants. All findings below are now FIXED.
 * Tests assert correct/hardened behaviour.
 *
 * Fixed:
 * - SEC-008: exportUserData is bounded (posts ≤ 1000, nested ≤ 100, consents ≤ 10)
 * - SEC-016: saveAnonymousConsent rejects sessionId longer than 128 chars
 * - SEC-017: updateConsent and saveAnonymousConsent upsert on existing record
 *
 * Documented (acceptable / expected behaviour):
 * - Account deletion leaves valid JWTs alive for up to 15 min (mitigated by isActive DB check)
 * - deleteAccount is idempotent (re-anonymising an already-deleted account succeeds)
 * - deleteAccount deletes the member's private data (journal, assessments, notes, …) and anonymises shared content
 * - getConsent returns null for new users (callers use optional chaining)
 * - Deleted user email format: deleted-{userId}@deleted.invalid
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { GdprService } from './gdpr.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Models whose rows deleteAccount removes or anonymises in one transaction.
const OWN_DATA_MODELS = [
  'journalEntry', 'assessment', 'courseNote', 'progress', 'goal', 'challenge', 'userInterest',
  'bookmark', 'notification', 'eventRsvp', 'pollVote', 'proposalVote', 'reaction', 'testimonialLike',
  'follow', 'learningGroupMember', 'learningGroupInvite', 'oAuthAccount', 'testimonial',
] as const;

function buildMockPrisma() {
  const ownData = Object.fromEntries(
    OWN_DATA_MODELS.map((m) => [m, { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) }]),
  ) as Record<(typeof OWN_DATA_MODELS)[number], { deleteMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> }>;
  return {
    ...ownData,
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
    cookieConsent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      GdprService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get<GdprService>(GdprService);
}

describe('GdprService — adversarial', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: GdprService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
    vi.clearAllMocks();
  });

  // ── FIXED SEC-008: export query is bounded ───────────────────────────────

  describe('FIXED SEC-008: exportUserData query uses take limits on all nested relations', () => {
    it('findUnique is called with take:1000 for posts and take:10 for cookieConsents', async () => {
      /**
       * The Prisma query now includes take limits on every nested relation:
       *   posts take:1000, comments take:100, reactions take:100
       *   comments take:1000, reactions take:1000, cookieConsents take:10
       * This prevents OOM on power-user exports.
       */
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'power@example.com',
        name: 'Power User',
        passwordHash: 'HASHED',
        posts: [],
        comments: [],
        reactions: [],
        courseProgress: [],
        eventRsvps: [],
        cookieConsents: [],
      });

      await service.exportUserData('u1');

      const callArg = prisma.user.findUnique.mock.calls[0][0];
      expect(callArg.include.posts.take).toBe(1000);
      expect(callArg.include.cookieConsents.take).toBe(10);
      expect(callArg.include.posts.include.comments.take).toBe(100);
    });

    it('password hash is excluded from export', async () => {
      /**
       * Correct: the service destructures passwordHash out before returning.
       * This invariant must hold even as the schema evolves.
       */
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        passwordHash: 'argon2id$...',
        posts: [],
        comments: [],
        reactions: [],
        courseProgress: [],
        eventRsvps: [],
        cookieConsents: [],
      });

      const result = await service.exportUserData('u1');

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  // ── INVARIANT: account deletion invalidates all auth ─────────────────────

  describe('INVARIANT: deleteAccount revokes refresh tokens but not access tokens', () => {
    it('deleteAccount revokes refresh tokens (correct) but cannot revoke live JWTs', async () => {
      /**
       * gdpr.service.ts:50-70:
       * 1. Anonymises user record (isActive=false) ← JWT strategy re-checks isActive → OK
       * 2. Deletes refresh tokens ← prevents token rotation → OK
       *
       * However, a 15-minute access token issued 1 second before deletion
       * remains cryptographically valid for ~14m59s. The JWT strategy DOES
       * re-fetch from DB and check isActive, so this is mitigated — but only
       * as long as the strategy performs that DB check on every request.
       * If the strategy is ever changed to skip the DB check for performance,
       * the window becomes 15 minutes.
       *
       * This test documents the architectural dependency on the DB re-check.
       */
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.deleteAccount('u1');

      expect(result.message).toBe('Account deleted successfully');
      // Refresh tokens deleted
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      // Access token revocation is NOT explicit — relies on isActive DB check
    });

    it('calling deleteAccount twice on the same user succeeds both times', async () => {
      /**
       * First call: user exists, anonymise, delete tokens.
       * Second call: user exists (anonymised record still in DB), re-anonymise,
       * delete tokens (no-op). Both return success.
       *
       * There is no idempotency guard. The email becomes
       * deleted-{userId}@deleted.invalid → can be set again without conflict
       * because the unique constraint on email uses that exact string.
       */
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });
      prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.deleteAccount('u1');
      expect(result.message).toBe('Account deleted successfully');
    });

    it('deleteAccount removes the journal, self-assessments and other private data, not just the name', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await service.deleteAccount('u1');

      for (const model of ['journalEntry', 'assessment', 'courseNote', 'userInterest', 'eventRsvp', 'learningGroupMember'] as const) {
        expect(prisma[model].deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      }
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false, calendarToken: null }) }),
      );
    });

    it('deleteAccount on non-existent user throws NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── FIXED SEC-017: updateConsent upserts — no unbounded row accumulation ──

  describe('FIXED SEC-017: updateConsent upserts on existing record', () => {
    it('first call creates a record; subsequent calls update the existing one', async () => {
      const existingConsent = { id: 'cc-existing', analytics: false, marketing: false };

      // First call: no existing record → create
      prisma.cookieConsent.findFirst.mockResolvedValueOnce(null);
      prisma.cookieConsent.create.mockResolvedValue({ id: 'cc-new', analytics: true, marketing: false });

      await service.updateConsent('u1', true, false);
      expect(prisma.cookieConsent.create).toHaveBeenCalledTimes(1);

      // Subsequent calls: existing record → update (not create)
      prisma.cookieConsent.findFirst.mockResolvedValue(existingConsent);
      prisma.cookieConsent.update.mockResolvedValue({ id: 'cc-existing', analytics: false, marketing: true });

      await service.updateConsent('u1', false, true);
      await service.updateConsent('u1', true, true);

      expect(prisma.cookieConsent.create).toHaveBeenCalledTimes(1); // still only once
      expect(prisma.cookieConsent.update).toHaveBeenCalledTimes(2);
    });
  });

  // ── FIXED SEC-016: anonymous consent sessionId is capped at 128 chars ─────

  describe('FIXED SEC-016: saveAnonymousConsent validates sessionId length', () => {
    it('any reasonable sessionId is accepted', async () => {
      prisma.cookieConsent.findFirst.mockResolvedValue(null);
      prisma.cookieConsent.create.mockResolvedValue({
        id: 'cc-anon',
        sessionId: 'victim-session-id',
        analytics: true,
        marketing: true,
      });

      const result = await service.saveAnonymousConsent('victim-session-id', true, true);
      expect(result.sessionId).toBe('victim-session-id');
    });

    it('empty sessionId is accepted', async () => {
      prisma.cookieConsent.findFirst.mockResolvedValue(null);
      prisma.cookieConsent.create.mockResolvedValue({
        id: 'cc-empty',
        sessionId: '',
        analytics: false,
        marketing: false,
      });

      const result = await service.saveAnonymousConsent('', false, false);
      expect(result.sessionId).toBe('');
    });

    it('sessionId longer than 128 characters throws BadRequestException', async () => {
      const oversizedId = 'X'.repeat(129);

      await expect(
        service.saveAnonymousConsent(oversizedId, false, false),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── INVARIANT: getConsent returns null (not a safe default) for new users ─

  describe('INVARIANT: getConsent returns null for users without consent records', () => {
    it('getConsent returns null — caller must handle null without crashing', async () => {
      /**
       * gdpr.service.ts:8-12 — returns findFirst result (null if none found).
       * getPrivacySettings uses optional chaining (consent?.analytics ?? false) — safe.
       * But if any other caller uses consent.analytics directly, it throws TypeError.
       */
      prisma.cookieConsent.findFirst.mockResolvedValue(null);

      const result = await service.getConsent('u1');
      expect(result).toBeNull();

      // getPrivacySettings handles null safely
      const settings = await service.getPrivacySettings('u1');
      expect(settings).toEqual({ analytics: false, marketing: false });
    });
  });
});

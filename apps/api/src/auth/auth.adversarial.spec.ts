/**
 * ADVERSARIAL TESTS: Authentication & Token Management
 *
 * Attack surfaces:
 * - Token refresh race condition (TOCTOU)
 * - Default secret fallback in production
 * - Refresh token accumulation (no cleanup)
 * - Account deletion does not immediately invalidate live JWTs
 * - Inactive user can still hold valid DB-resident tokens
 * - Register with pathological inputs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvitesService } from '../invites/invites.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

// ── helpers ─────────────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    platformSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
  };
}

const mockJwt = {
  sign: vi.fn().mockReturnValue('signed-access-token'),
};

const mockInvites = {
  validateInvite: vi.fn(),
  consumeInvite: vi.fn(),
};

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  del: vi.fn().mockResolvedValue(1),
};

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: mockJwt },
      { provide: InvitesService, useValue: mockInvites },
      { provide: REDIS_CLIENT, useValue: mockRedis },
    ],
  }).compile();
  return module.get<AuthService>(AuthService);
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('AuthService — adversarial', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: AuthService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
    vi.clearAllMocks();
    mockJwt.sign.mockReturnValue('signed-access-token');
  });

  // ── INVARIANT: token refresh is non-duplicable ──────────────────────────

  describe('FIXED SEC-005: refresh token rotation preserves a single successor', () => {
    it('two concurrent same-token requests cannot create separate successors', async () => {
      const old = { token: 'old-refresh-token', userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000), rotatedAt: null as Date | null,
        replacedBy: null as string | null };
      const tokens = new Map<string, any>([['old-refresh-token', old]]);
      prisma.refreshToken.findUnique.mockImplementation(async ({ where }: any) => tokens.get(where.token) ?? null);
      (prisma.refreshToken as any).updateMany = vi.fn(async ({ where, data }: any) => {
        const row = tokens.get(where.token);
        if (row.replacedBy || row.rotatedAt) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      });
      (prisma.refreshToken as any).update = vi.fn(async ({ where, data }: any) => {
        Object.assign(tokens.get(where.token), data);
      });
      prisma.refreshToken.create.mockImplementation(async ({ data }: any) => {
        tokens.set(data.token, { ...data, replacedBy: null, rotatedAt: null });
        return { id: 'successor' };
      });
      (prisma as any).$transaction = async (callback: any) => callback(prisma);
      mockJwt.sign.mockReturnValueOnce('access').mockReturnValueOnce('successor-token').mockReturnValue('retry-access');

      const [a, b] = await Promise.allSettled([
        service.refresh('user-1', 'user@example.com', 'MEMBER', 'old-refresh-token'),
        service.refresh('user-1', 'user@example.com', 'MEMBER', 'old-refresh-token'),
      ]);
      expect([a, b].filter(x => x.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(old.replacedBy).toBe('successor-token');
    });

    it('retry uses the existing successor without minting another', async () => {
      const old = { token: 'captured-refresh-token', userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000), rotatedAt: new Date(),
        replacedBy: 'active-successor' };
      prisma.refreshToken.findUnique.mockImplementation(async ({ where }: any) =>
        where.token === old.token ? old :
          where.token === old.replacedBy ? { userId: 'user-1', expiresAt: new Date(Date.now() + 60_000) } : null);
      const result = await service.refresh('user-1', 'user@example.com', 'MEMBER', old.token);
      expect(result.refreshToken).toBe('active-successor');
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  // ── FIXED SEC-009: expired tokens are purged on every token generation ──

  describe('FIXED SEC-009: generateTokens purges expired tokens on every call', () => {
    it('each login purges expired tokens — 3 logins = 3 deleteMany calls', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        role: 'MEMBER',
        isActive: true,
        avatarUrl: null,
        passwordHash,
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      await service.login({ email: 'user@example.com', password: 'password123' });
      await service.login({ email: 'user@example.com', password: 'password123' });
      await service.login({ email: 'user@example.com', password: 'password123' });

      // One expired-token purge per generateTokens() call → 3 total.
      // Active (non-expired) tokens are NOT deleted — multi-session is preserved.
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(3);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(3);
      // Each purge targets this user's expired tokens only
      const purgeCall = prisma.refreshToken.deleteMany.mock.calls[0][0];
      expect(purgeCall.where).toHaveProperty('userId', 'user-1');
      expect(purgeCall.where).toHaveProperty('expiresAt');
    });
  });

  // ── INVARIANT: deactivated users cannot authenticate ───────────────────

  describe('INVARIANT: inactive users are blocked at login', () => {
    it('deactivated user receives UnauthorizedException even with correct password', async () => {
      const passwordHash = await argon2.hash('validpass');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'inactive@example.com',
        isActive: false,
        passwordHash,
      });

      await expect(
        service.login({ email: 'inactive@example.com', password: 'validpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── FIXED SEC-004: no default secret fallback ───────────────────────────

  describe('FIXED SEC-004: generateTokens uses env secret with no hardcoded fallback', () => {
    it('jwtService.sign is called with process.env.JWT_SECRET (undefined if unset, not a fallback)', async () => {
      /**
       * The || 'default-secret' fallback has been removed. Startup validation
       * (main.ts) exits with code 1 if JWT_SECRET is missing, so undefined
       * only occurs in misconfigured environments that should never reach this path.
       * The mock jwtService ignores the secret value, but we verify no fallback string is passed.
       */
      const original = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'new@example.com',
        name: 'New',
        role: 'MEMBER',
        avatarUrl: null,
        createdAt: new Date(),
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt' });

      await service.register({ email: 'new@example.com', name: 'New', password: 'password123' });

      const signArgs = mockJwt.sign.mock.calls[0];
      // No hardcoded fallback — secret is undefined (startup validation prevents this in production)
      expect(signArgs[1].secret).toBeUndefined();

      if (original !== undefined) process.env.JWT_SECRET = original;
    });
  });

  // ── FIXED SEC-022: email is normalised before lookup ────────────────────

  describe('FIXED SEC-022: email is lowercased before registration lookup', () => {
    it('USER@EXAMPLE.COM is normalised to user@example.com — finds existing account and rejects', async () => {
      /**
       * register() lowercases + trims the email before calling findUnique.
       * USER@EXAMPLE.COM → user@example.com → findUnique returns the existing user → ConflictException.
       */
      const existingUser = { id: 'u1', email: 'user@example.com' };
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.register({ email: 'USER@EXAMPLE.COM', name: 'Upper', password: 'password123' }),
      ).rejects.toThrow(ConflictException);

      // Confirm the lookup used the normalised (lowercased) address
      const lookupArg = prisma.user.findUnique.mock.calls[0][0];
      expect(lookupArg.where.email).toBe('user@example.com');
    });

    it('new registration with uppercase email is stored in lowercase', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u2',
        email: 'user@example.com', // stored lowercase
        name: 'Upper',
        role: 'MEMBER',
        avatarUrl: null,
        createdAt: new Date(),
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt' });

      const result = await service.register({
        email: 'USER@EXAMPLE.COM',
        name: 'Upper',
        password: 'password123',
      });

      // Confirm create was called with normalised email
      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.email).toBe('user@example.com');
      expect(result.user.email).toBe('user@example.com');
    });
  });

  // ── INVARIANT: logout is idempotent and doesn't throw on missing token ──

  describe('INVARIANT: logout with unknown/already-used token must not error', () => {
    it('deleteMany with no matching token returns gracefully', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.logout('nonexistent-refresh-token');
      expect(result.message).toBe('Logged out successfully');
    });
  });

  // ── INVARIANT: register rejects malformed inputs ────────────────────────

  describe('INVARIANT: pathological register inputs', () => {
    it('unicode-only name is accepted (no character type restriction)', async () => {
      /**
       * No character-set restriction on name. Chinese, emoji, RTL characters,
       * zero-width joiners all pass @IsString() + MaxLength(100).
       * This could break rendering, search, and export downstream.
       */
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u3',
        email: 'unicode@example.com',
        name: '你好🎉​‮',
        role: 'MEMBER',
        avatarUrl: null,
        createdAt: new Date(),
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt' });

      const result = await service.register({
        email: 'unicode@example.com',
        name: '你好🎉​‮',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      // No error thrown — the name passes through as-is
    });

    it('password of exactly 8 chars (minimum) is accepted — weak password policy', async () => {
      /**
       * MinLength(8) only. 'password', '12345678', 'aaaaaaaa' all pass.
       * No complexity, entropy, or common-password check exists.
       */
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u4',
        email: 'weak@example.com',
        name: 'Weak',
        role: 'MEMBER',
        avatarUrl: null,
        createdAt: new Date(),
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt' });

      const result = await service.register({
        email: 'weak@example.com',
        name: 'Weak',
        password: 'password',
      });

      expect(result.user).toBeDefined();
    });
  });

  // ── INVARIANT: existing tokens revoked on account delete ────────────────

  describe('INVARIANT: account deletion revokes all tokens', () => {
    it('logout only accepts a single refresh token — does NOT mass-revoke all user tokens', async () => {
      /**
       * AuthService.logout() deletes ONE refresh token (the one provided).
       * If a user has 5 sessions (5 refresh tokens), logout from one session
       * leaves 4 active sessions unrevoked.
       *
       * Only deleteAccount() calls deleteMany({ where: { userId } }).
       * This means "logout" is not a security boundary for multi-session users.
       */
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.findUnique.mockResolvedValue({ token: 'rt-session-1', replacedBy: null });

      await service.logout('rt-session-1');

      // Only deletes the provided token, not all tokens for the user
      const call = prisma.refreshToken.deleteMany.mock.calls[0][0];
      expect(call.where).toEqual({ token: 'rt-session-1' });
      // No userId filter — only 1 of N sessions is terminated
      expect(call.where).not.toHaveProperty('userId');
    });
  });
});

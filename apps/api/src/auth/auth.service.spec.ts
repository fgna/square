import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvitesService } from '../invites/invites.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

const mockPrisma = {
  platformSettings: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

const mockJwt = {
  sign: vi.fn().mockReturnValue('mock-jwt-token'),
};

const mockInvites = {
  validateInvite: vi.fn().mockResolvedValue({ valid: true, email: 'test@example.com' }),
  consumeInvite: vi.fn().mockResolvedValue(null),
};

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  del: vi.fn().mockResolvedValue(1),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: InvitesService, useValue: mockInvites },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    vi.clearAllMocks();
    // Sign-ups open unless a test says otherwise (no settings row yet).
    mockPrisma.platformSettings.findUnique.mockResolvedValue(null);
  });

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'MEMBER',
        avatarUrl: null,
        createdAt: new Date(),
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'token-1' });

      const result = await service.register({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      // jwtService.sign is called twice: once for the access token and once
      // for the refresh token (which now carries a jti claim for uniqueness)
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      // The second call includes jti so the DB unique constraint is never hit
      const refreshCall = mockJwt.sign.mock.calls[1];
      expect(refreshCall[0]).toHaveProperty('jti');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({ email: 'existing@example.com', name: 'Test', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses registration without an invitation when sign-ups are switched off', async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue({ allowSignups: false });

      await expect(
        service.register({ email: 'stranger@example.com', name: 'Stranger', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('still lets invited people register when sign-ups are switched off', async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue({ allowSignups: false });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-2', email: 'test@example.com', name: 'Invited', role: 'MEMBER', avatarUrl: null, createdAt: new Date(),
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'token-2' });

      const result = await service.register({
        email: 'test@example.com', name: 'Invited', password: 'password123', inviteToken: 'invite-1',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(mockInvites.consumeInvite).toHaveBeenCalledWith('invite-1');
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const passwordHash = await argon2.hash('password123');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'MEMBER',
        isActive: true,
        avatarUrl: null,
        passwordHash,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'token-1' });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        passwordHash,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

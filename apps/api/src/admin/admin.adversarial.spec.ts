/**
 * ADVERSARIAL TESTS: Admin Service
 *
 * Originally documented broken invariants. All findings below are now FIXED.
 * Tests assert correct/hardened behaviour.
 *
 * Fixed:
 * - SEC-006: Audit log IS written for every admin action
 * - SEC-007: Last-admin guard prevents self-demotion / self-deactivation
 * - SEC-015: updateUserRole uses @IsEnum at controller; invalid roles still
 *            throw at service level (Prisma P2006)
 * - SEC-021: getModerationQueue is now paginated
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { GdprService } from '../gdpr/gdpr.service';

function buildMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    course: {
      count: vi.fn(),
    },
    event: {
      count: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    postReport: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    platformSettings: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

const mockGdpr = { deleteAccount: vi.fn().mockResolvedValue({ message: 'Account deleted successfully' }) };

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      AdminService,
      { provide: PrismaService, useValue: prisma },
      { provide: GdprService, useValue: mockGdpr },
    ],
  }).compile();
  return module.get<AdminService>(AdminService);
}

describe('AdminService — adversarial', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: AdminService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
    vi.clearAllMocks();
  });

  // ── FIXED SEC-006: every admin action is audit-logged ───────────────────

  describe('SEC-006 FIXED: admin actions write to AuditLog', () => {
    it('updateUserRole writes an AuditLog entry', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'MEMBER' });
      prisma.user.update.mockResolvedValue({ id: 'u1', email: 'u@example.com', name: 'User', role: 'ADMIN' });
      prisma.user.count.mockResolvedValue(2);
      prisma.auditLog.create.mockResolvedValue({});

      await service.updateUserRole('u1', 'ADMIN', 'actor-id');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'UPDATE_USER_ROLE', resource: 'User:u1' }),
        }),
      );
    });

    it('toggleUserActive writes an AuditLog entry', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, role: 'MEMBER' });
      prisma.user.update.mockResolvedValue({ id: 'u1', email: 'u@example.com', name: 'User', isActive: false });
      prisma.user.count.mockResolvedValue(0);
      prisma.auditLog.create.mockResolvedValue({});

      await service.toggleUserActive('u1', 'actor-id');

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('hidePost writes an AuditLog entry', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'p1', isHidden: false });
      prisma.post.update.mockResolvedValue({ id: 'p1', isHidden: true });
      prisma.auditLog.create.mockResolvedValue({});

      await service.hidePost('p1', 'actor-id');

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('pinPost writes an AuditLog entry', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'p1', isPinned: false });
      prisma.post.update.mockResolvedValue({ id: 'p1', isPinned: true });
      prisma.auditLog.create.mockResolvedValue({});

      await service.pinPost('p1', 'actor-id');

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  // ── FIXED SEC-007: last-admin guard prevents system lockout ─────────────

  describe('SEC-007 FIXED: last-admin guard and self-target protection', () => {
    it('admin cannot demote themselves — self-target blocked', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });

      await expect(service.updateUserRole('admin-1', 'MEMBER', 'admin-1'))
        .rejects.toThrow('Cannot demote yourself');
    });

    it('cannot remove the last admin via role change', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
      prisma.user.count.mockResolvedValue(1);

      await expect(service.updateUserRole('admin-1', 'MEMBER', 'different-admin'))
        .rejects.toThrow('Cannot remove the last admin');
    });

    it('a deleted account cannot be restored or promoted — its data is gone and it cannot sign in', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u9', email: 'deleted-u9@deleted.invalid', role: 'MEMBER', isActive: false });

      await expect(service.toggleUserActive('u9', 'admin-1')).rejects.toThrow('A deleted account cannot be restored');
      await expect(service.updateUserRole('u9', 'ADMIN', 'admin-1')).rejects.toThrow('A deleted account cannot be changed');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('admin cannot deactivate themselves', async () => {
      await expect(service.toggleUserActive('admin-1', 'admin-1'))
        .rejects.toThrow('Cannot deactivate yourself');
    });

    it('cannot deactivate the last active admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', isActive: true });
      prisma.user.count.mockResolvedValue(1);

      await expect(service.toggleUserActive('admin-1', 'different-admin'))
        .rejects.toThrow('Cannot deactivate the last admin');
    });

    it('demoting a non-admin to MEMBER succeeds without last-admin check', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'MEMBER' });
      prisma.user.update.mockResolvedValue({ id: 'u1', email: 'u@example.com', name: 'User', role: 'MEMBER' });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserRole('u1', 'MEMBER', 'admin-id');
      expect(result.role).toBe('MEMBER');
    });
  });

  // ── SEC-015 FIXED at controller: invalid roles blocked by @IsEnum ────────

  describe('SEC-015 FIXED: updateUserRole rejects invalid role strings', () => {
    it('updateUserRole with "SUPERADMIN" throws (Prisma P2006 at service level)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'MEMBER' });
      const dbError = new Error('Invalid value for enum Role: SUPERADMIN') as any;
      dbError.code = 'P2006';
      prisma.user.update.mockRejectedValue(dbError);

      await expect(service.updateUserRole('u1', 'SUPERADMIN', 'actor-id')).rejects.toThrow();
    });

    it('updateUserRole with empty string throws', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'MEMBER' });
      const dbError = new Error('Invalid enum value') as any;
      dbError.code = 'P2006';
      prisma.user.update.mockRejectedValue(dbError);

      await expect(service.updateUserRole('u1', '', 'actor-id')).rejects.toThrow();
    });
  });

  // ── getAllUsers: intentionally exposes full data to admins ───────────────

  describe('getAllUsers exposes emails of deactivated/deleted users (admin-only, correct)', () => {
    it('getAllUsers includes anonymised deleted-user records', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'active@example.com', role: 'MEMBER', isActive: true, _count: { posts: 5 } },
        { id: 'u2', email: 'deleted-u2@deleted.invalid', role: 'MEMBER', isActive: false, _count: { posts: 2 } },
      ]);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.getAllUsers(1, 20);
      const deletedUser = result.data.find((u) => !u.isActive);

      expect(deletedUser?.email).toBe('deleted-u2@deleted.invalid');
    });
  });

  // ── FIXED SEC-021: getModerationQueue is paginated ───────────────────────

  describe('SEC-021 FIXED: getModerationQueue returns paginated results', () => {
    it('getModerationQueue returns paginated response with total count', async () => {
      prisma.post.findMany.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          id: `p-${i}`,
          content: 'spam',
          isHidden: true,
          author: { id: 'spammer', name: 'Spammer', email: 'spam@evil.com' },
          _count: { comments: 0, reactions: 0 },
        })),
      );
      prisma.post.count.mockResolvedValue(10000);

      const result = await service.getModerationQueue(1, 20);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 10000);
      expect(result).toHaveProperty('totalPages', 500);
      expect(result.data).toHaveLength(20);
    });

    it('refuses a welcome video link that cannot be embedded', async () => {
      await expect(service.updatePlatformSettings({ welcomeVideoUrl: 'https://example.com/hello.mp4' })).rejects.toThrow(
        'Welcome video must be a Loom, Vimeo or YouTube link',
      );
      expect(prisma.platformSettings.upsert).not.toHaveBeenCalled();
    });

    it('stores an empty welcome video link as none', async () => {
      await service.updatePlatformSettings({ welcomeVideoUrl: '  ' });
      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ welcomeVideoUrl: null }) }),
      );
    });

    it('lists posts with open reports, with their reasons', async () => {
      prisma.post.findMany.mockResolvedValue([]);
      prisma.post.count.mockResolvedValue(0);

      await service.getModerationQueue(1, 20, 'reported');

      const args = prisma.post.findMany.mock.calls.at(-1)![0];
      expect(args.where).toEqual({ reports: { some: { resolvedAt: null } } });
      expect(args.include.reports.where).toEqual({ resolvedAt: null });
    });

    it('closes open reports when a post is hidden', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'p1', isHidden: false });
      prisma.post.update.mockResolvedValue({ id: 'p1', isHidden: true });

      await service.hidePost('p1', 'admin-1');

      expect(prisma.postReport.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { postId: 'p1', resolvedAt: null } }),
      );
    });

    it('lists hidden posts by default and visible posts on request', async () => {
      prisma.post.findMany.mockResolvedValue([]);
      prisma.post.count.mockResolvedValue(0);

      await service.getModerationQueue(1, 20);
      expect(prisma.post.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { isHidden: true } }),
      );

      await service.getModerationQueue(1, 20, false);
      expect(prisma.post.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { isHidden: false } }),
      );
      expect(prisma.post.count).toHaveBeenLastCalledWith({ where: { isHidden: false } });
    });
  });

  // ── hidePost/pinPost are toggles (documented behaviour) ─────────────────

  describe('hidePost and pinPost are toggle operations (not explicit set)', () => {
    it('two consecutive hidePost calls restore the original visibility', async () => {
      prisma.post.findUnique
        .mockResolvedValueOnce({ id: 'p1', isHidden: false })
        .mockResolvedValueOnce({ id: 'p1', isHidden: true });
      prisma.post.update
        .mockResolvedValueOnce({ id: 'p1', isHidden: true })
        .mockResolvedValueOnce({ id: 'p1', isHidden: false });
      prisma.auditLog.create.mockResolvedValue({});

      const first = await service.hidePost('p1', 'actor-id');
      const second = await service.hidePost('p1', 'actor-id');

      expect(first.isHidden).toBe(true);
      expect(second.isHidden).toBe(false);
    });
  });
});

describe('AdminService.deleteUser — admins delete members for them', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: AdminService;
  const member = { id: 'm1', email: 'Bob@Example.com', role: 'MEMBER', isActive: false };

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
    vi.clearAllMocks();
  });

  it('deletes with the same deletion as "delete my account" and logs only the id', async () => {
    prisma.user.findUnique.mockResolvedValue(member);

    await service.deleteUser('m1', ' bob@example.com ', 'admin1');

    expect(mockGdpr.deleteAccount).toHaveBeenCalledWith('m1');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { action: 'DELETE_USER', resource: 'User:m1', userId: 'admin1' },
    });
  });

  it('refuses when the typed e-mail does not match', async () => {
    prisma.user.findUnique.mockResolvedValue(member);

    await expect(service.deleteUser('m1', 'alice@example.com', 'admin1')).rejects.toThrow('does not match');
    expect(mockGdpr.deleteAccount).not.toHaveBeenCalled();
  });

  it('refuses to delete yourself, an admin or an already deleted account', async () => {
    await expect(service.deleteUser('admin1', 'x', 'admin1')).rejects.toThrow('your own account');

    prisma.user.findUnique.mockResolvedValue({ id: 'a2', email: 'a2@example.com', role: 'ADMIN' });
    await expect(service.deleteUser('a2', 'a2@example.com', 'admin1')).rejects.toThrow('Demote');

    prisma.user.findUnique.mockResolvedValue({ id: 'd1', email: 'deleted-d1@deleted.invalid', role: 'MEMBER' });
    await expect(service.deleteUser('d1', 'deleted-d1@deleted.invalid', 'admin1')).rejects.toThrow('already deleted');

    expect(mockGdpr.deleteAccount).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('reports an unknown account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.deleteUser('nope', 'x@example.com', 'admin1')).rejects.toThrow('not found');
  });
});

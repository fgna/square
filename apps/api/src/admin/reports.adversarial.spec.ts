/**
 * ADVERSARIAL TESTS: Admin Reports / CSV Export
 *
 * SEC-056: CSV exports now have take limit — FIXED (max 10000 rows)
 * SEC-057: PII removed from content-focused CSV exports — FIXED
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  return {
    user: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
    progress: { findMany: vi.fn() },
  };
}

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      ReportsService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get<ReportsService>(ReportsService);
}

describe('[SEC-056] CSV exports have take limit — FIXED', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: ReportsService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
  });

  it('exportMembersCsv calls findMany with take limit', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.exportMembersCsv();

    const callArgs = prisma.user.findMany.mock.calls[0][0];
    expect(callArgs.take).toBeDefined();
    expect(callArgs.take).toBeLessThanOrEqual(10000);
  });

  it('exportPostsCsv calls findMany with take limit', async () => {
    prisma.post.findMany.mockResolvedValue([]);

    await service.exportPostsCsv();

    const callArgs = prisma.post.findMany.mock.calls[0][0];
    expect(callArgs.take).toBeDefined();
    expect(callArgs.take).toBeLessThanOrEqual(10000);
  });

  it('exportCourseProgressCsv calls findMany with take limit', async () => {
    prisma.progress.findMany.mockResolvedValue([]);

    await service.exportCourseProgressCsv();

    const callArgs = prisma.progress.findMany.mock.calls[0][0];
    expect(callArgs.take).toBeDefined();
    expect(callArgs.take).toBeLessThanOrEqual(10000);
  });
});

describe('[SEC-057] PII removed from content CSV exports — FIXED', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: ReportsService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
  });

  it('exportPostsCsv does not include author email addresses', async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        title: 'Test Post',
        content: 'Content',
        type: 'TEXT',
        isPinned: false,
        createdAt: new Date('2026-01-01'),
        author: { name: 'Alice' },
        _count: { comments: 0, reactions: 0 },
      },
    ]);

    const csv = await service.exportPostsCsv();

    expect(csv).not.toContain('email');
    expect(csv).toContain('Alice');
  });

  it('exportCourseProgressCsv does not include user email addresses', async () => {
    prisma.progress.findMany.mockResolvedValue([
      {
        user: { name: 'Bob' },
        course: { title: 'Leadership 101' },
        percentage: 100,
        completedAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ]);

    const csv = await service.exportCourseProgressCsv();

    expect(csv).not.toContain('email');
    expect(csv).toContain('Bob');
  });

  it('exportMembersCsv still includes email (purpose of member report)', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        membershipTier: 'PREMIUM',
        isActive: true,
        createdAt: new Date('2026-01-01'),
        _count: { posts: 5, comments: 3, courseProgress: 2 },
      },
    ]);

    const csv = await service.exportMembersCsv();

    expect(csv).toContain('admin@test.com');
  });
});

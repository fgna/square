import { describe, it, expect, vi } from 'vitest';
import { ReportsService } from './reports.service';

describe('course participation for admins', () => {
  it('lists members with progress, finished lessons and last activity, and sums them up', async () => {
    const recent = new Date();
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const prisma: any = {
      course: { findUnique: vi.fn().mockResolvedValue({ id: 'c1', title: 'Kurs', modules: [{ _count: { lessons: 3 } }, { _count: { lessons: 2 } }] }) },
      progress: {
        findMany: vi.fn().mockResolvedValue([
          { percentage: 100, completedLessons: ['a', 'b', 'c', 'd', 'e'], completedAt: recent, createdAt: old, updatedAt: recent, user: { id: 'u1', name: 'Ann', avatarUrl: null } },
          { percentage: 40.4, completedLessons: ['a', 'b'], completedAt: null, createdAt: old, updatedAt: old, user: { id: 'u2', name: 'Ben', avatarUrl: null } },
        ]),
      },
    };
    const result = await new ReportsService(prisma).courseParticipation('c1');
    expect(result.course).toEqual({ id: 'c1', title: 'Kurs', lessons: 5 });
    expect(result.summary).toEqual({ started: 2, completed: 1, activeLast30Days: 1 });
    expect(result.members[1]).toMatchObject({ name: 'Ben', percentage: 40, completedLessons: 2 });
  });

  it('answers 404 for an unknown course', async () => {
    const prisma: any = { course: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ReportsService(prisma).courseParticipation('x')).rejects.toMatchObject({ status: 404 });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('member task data export', () => {
  it('exports all attempts and hint sessions scoped to the authenticated member', async () => {
    const attempts = [{ taskId: 'sample.count', response: 3, correct: true, hintsUsed: 1 }];
    const hints = [{ taskId: 'sample.count', hintsUsed: 1 }];
    const attemptFindMany = vi.fn().mockResolvedValue(attempts);
    const hintFindMany = vi.fn().mockResolvedValue(hints);
    const service = new UsersService({
      taskAttempt: { findMany: attemptFindMany },
      taskHintSession: { findMany: hintFindMany },
    } as unknown as PrismaService);
    await expect(service.exportTaskData('alice')).resolves.toEqual({
      schemaVersion: 1, attempts, hintSessions: hints,
    });
    for (const spy of [attemptFindMany, hintFindMany]) {
      const query = spy.mock.calls[0][0];
      expect(query.where).toEqual({ userId: 'alice' });
      expect(query.take).toBeUndefined();
      expect(query.select.userId).toBeUndefined();
      expect(query.select.idempotencyKey).toBe(true);
      expect(query.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    }
  });

  it('supports a member without any task records', async () => {
    const service = new UsersService({
      taskAttempt: { findMany: vi.fn().mockResolvedValue([]) },
      taskHintSession: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService);
    await expect(service.exportTaskData('bob')).resolves.toEqual({
      schemaVersion: 1, attempts: [], hintSessions: [],
    });
  });
});

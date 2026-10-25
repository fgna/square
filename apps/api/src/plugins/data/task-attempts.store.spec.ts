import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskAttemptStore } from './task-attempts.store';

const attempt = {
  taskId: 'sample.count',
  taskVersion: 1,
  idempotencyKey: 'attempt_000001',
  response: 3,
  correct: true,
  hintsUsed: 0,
};

function setup(operations: Record<string, unknown>) {
  return new TaskAttemptStore({ taskAttempt: operations } as unknown as PrismaService);
}

describe('TaskAttemptStore', () => {
  it('records attempts with authenticated member identity', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'a1', userId: 'alice', ...attempt });
    const result = await setup({ create }).record('alice', attempt);
    expect(result.id).toBe('a1');
    expect(create).toHaveBeenCalledWith({ data: { userId: 'alice', ...attempt } });
  });

  it('lists attempts only for the authenticated member, with bounded history', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await setup({ findMany }).list('alice', 'sample.count');
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'alice', taskId: 'sample.count' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    await setup({ findMany }).list('bob');
    expect(findMany).toHaveBeenLastCalledWith({
      where: { userId: 'bob' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  });

  it('replays an identical idempotency key without duplicating the attempt', async () => {
    const existing = { id: 'a1', userId: 'alice', ...attempt };
    const create = vi.fn().mockRejectedValue({ code: 'P2002' });
    const findUnique = vi.fn().mockResolvedValue(existing);
    const result = await setup({ create, findUnique }).record('alice', attempt);
    expect(result).toEqual(existing);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_idempotencyKey: { userId: 'alice', idempotencyKey: attempt.idempotencyKey } },
    });
  });

  it('rejects changed payloads sharing a member idempotency key', async () => {
    const existing = { id: 'a1', userId: 'alice', ...attempt };
    const create = vi.fn().mockRejectedValue({ code: 'P2002' });
    const findUnique = vi.fn().mockResolvedValue(existing);
    await expect(setup({ create, findUnique }).record('alice', { ...attempt, response: 4 }))
      .rejects.toThrow('Idempotency key already used');
  });

  it('rejects invalid input before writing', async () => {
    const create = vi.fn();
    const store = setup({ create });
    await expect(store.record('alice', { ...attempt, response: Infinity })).rejects.toThrow();
    await expect(store.record('alice', { ...attempt, hintsUsed: -1 })).rejects.toThrow();
    await expect(store.record('alice', { ...attempt, response: ['red', 'red'] })).rejects.toThrow();
    await expect(store.record('', attempt)).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    expect(() => store.list('alice', '../unsafe')).toThrow();
  });

  it('propagates unrelated storage failures rather than assuming a duplicate', async () => {
    const error = new Error('database unavailable');
    const create = vi.fn().mockRejectedValue(error);
    await expect(setup({ create }).record('alice', attempt)).rejects.toBe(error);
  });
});

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

  it('lists a task family by id prefix, newest first, with a bounded limit', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await setup({ findMany }).listByPrefix('alice', 'sample.');
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'alice', taskId: { startsWith: 'sample.' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    await setup({ findMany }).listByPrefix('alice', 'sample.', 1000);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 1000 }));
    for (const [prefix, limit] of [['', 10], ['%', 10], ['Sample', 10], ['sample.', 0], ['sample.', 1001], ['sample.', 1.5]] as const) {
      expect(() => setup({ findMany }).listByPrefix('alice', prefix, limit)).toThrow(/Invalid member, task prefix or limit/);
    }
    expect(() => setup({ findMany }).listByPrefix('', 'sample.')).toThrow();
    expect(findMany).toHaveBeenCalledTimes(2);
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

  it('replays a choice selection in a different order without double-recording', async () => {
    const choiceAttempt = { ...attempt, response: ['square', 'rectangle'] };
    const existing = { id: 'a2', userId: 'alice', ...choiceAttempt };
    const create = vi.fn().mockRejectedValue({ code: 'P2002' });
    const findUnique = vi.fn().mockResolvedValue(existing);
    await expect(setup({ create, findUnique }).record('alice', {
      ...choiceAttempt, response: ['rectangle', 'square'],
    })).resolves.toEqual(existing);
  });

  it('keeps idempotency keys member-scoped even when two members use the same key', async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({
      id: data.userId === 'alice' ? 'a1' : 'b1',
      ...data,
    }));
    const store = setup({ create });
    const alice = await store.record('alice', attempt);
    const bob = await store.record('bob', attempt);
    expect(alice.id).not.toBe(bob.id);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([request]) => request.data.userId)).toEqual(['alice', 'bob']);
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

  it('records trusted hints per member and pending attempt key', async () => {
    const create = vi.fn().mockResolvedValue({ hintsUsed: 1 });
    const findUniqueAttempt = vi.fn().mockResolvedValue(null);
    const store = new TaskAttemptStore({
      taskAttempt: { findUnique: findUniqueAttempt },
      taskHintSession: { create },
    } as unknown as PrismaService);
    await expect(store.revealHint('alice', 'sample.count', 1, 'request_12345678', 1))
      .resolves.toBe(1);
    expect(create).toHaveBeenCalledWith({
      data: { userId: 'alice', taskId: 'sample.count', taskVersion: 1,
        idempotencyKey: 'request_12345678', hintsUsed: 1 },
    });
    expect(findUniqueAttempt).toHaveBeenCalledWith({
      where: { userId_idempotencyKey: { userId: 'alice', idempotencyKey: 'request_12345678' } },
    });
  });

  it('rejects revealing hints after an attempt has been recorded', async () => {
    const create = vi.fn();
    const store = new TaskAttemptStore({
      taskAttempt: { findUnique: vi.fn().mockResolvedValue({ id: 'submitted' }) },
      taskHintSession: { create },
    } as unknown as PrismaService);
    await expect(store.revealHint('alice', 'sample.count', 1, 'request_12345678', 1))
      .rejects.toThrow('already been submitted');
    expect(create).not.toHaveBeenCalled();
  });

  it('reads hint counts only when member, task, version and attempt key match', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      userId: 'alice', taskId: 'sample.count', taskVersion: 1, hintsUsed: 1,
    });
    const store = new TaskAttemptStore({
      taskHintSession: { findUnique },
    } as unknown as PrismaService);
    await expect(store.hintUsage('alice', 'sample.count', 1, 'request_12345678'))
      .resolves.toBe(1);
    await expect(store.hintUsage('alice', 'other.task', 1, 'request_12345678'))
      .rejects.toThrow('different task');
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_idempotencyKey: { userId: 'alice', idempotencyKey: 'request_12345678' } },
    });
  });

  it('propagates unrelated storage failures rather than assuming a duplicate', async () => {
    const error = new Error('database unavailable');
    const create = vi.fn().mockRejectedValue(error);
    await expect(setup({ create }).record('alice', attempt)).rejects.toBe(error);
  });
});

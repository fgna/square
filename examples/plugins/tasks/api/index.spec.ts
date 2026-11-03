import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import plugin from './index';

function controller() {
  const record = vi.fn().mockImplementation(async (_memberId, input) => ({
    id: 'attempt-1', ...input,
  }));
  const list = vi.fn().mockResolvedValue([]);
  const revealHint = vi.fn().mockResolvedValue(1);
  const hintUsage = vi.fn().mockResolvedValue(0);
  const listByPrefix = vi.fn().mockResolvedValue([]);
  const registration = plugin.register({
    pluginId: 'tasks',
    CurrentUser: () => () => undefined,
    Roles: () => () => undefined,
    data: { tasks: { record, list, listByPrefix, revealHint, hintUsage }, journal: {} as never },
    contentPack: {} as never,
  });
  const ControllerType = registration.controllers![0] as new () => {
    tasks(): Array<Record<string, unknown>>;
    history(memberId: string): Promise<unknown>;
    submit(memberId: string, body: unknown): Promise<{ correct: boolean }>;
    reveal(memberId: string, body: unknown): Promise<{ text: string; hintsUsed: number }>;
  };
  return { api: new ControllerType(), record, list, revealHint, hintUsage };
}
const request = (taskId: string, response: number | string[]) => ({
  taskId, taskVersion: 1, response, idempotencyKey: 'request_12345678',
});

describe('neutral tasks example API', () => {
  it('returns three formats without keys or expected answers', () => {
    const { api } = controller();
    const tasks = api.tasks();
    expect(tasks.map(task => task.responseType)).toEqual(['number', 'single_choice', 'multiple_choice']);
    for (const task of tasks) {
      expect(task).not.toHaveProperty('expected');
      expect(task).not.toHaveProperty('correctOptionIds');
    }
  });

  it.each([
    ['sample.count', 3, true],
    ['sample.count', 4, false],
    ['sample.color', ['red'], true],
    ['sample.color', ['gray'], false],
    ['sample.shapes', ['rectangle', 'square'], true],
    ['sample.shapes', ['square'], false],
  ] as const)('grades %s response %j', async (id, response, correct) => {
    const { api, record } = controller();
    expect((await api.submit('member-a', request(id, Array.isArray(response) ? [...response] : response))).correct).toBe(correct);
    expect(record).toHaveBeenCalledWith('member-a', expect.objectContaining({ correct, hintsUsed: 0 }));
  });

  it.each([
    request('sample.color', ['red', 'red']),
    request('sample.color', ['red', 'gray']),
    request('sample.shapes', ['unknown']),
    request('sample.shapes', []),
    request('sample.count', ['red']),
    request('unknown', 3),
    { ...request('sample.count', 3), memberId: 'someone-else' },
    { ...request('sample.count', 3), taskVersion: 999 },
  ])('rejects malformed or spoofed submissions', async (body) => {
    const { api, record } = controller();
    await expect(api.submit('member-a', body)).rejects.toBeInstanceOf(BadRequestException);
    expect(record).not.toHaveBeenCalled();
  });

  it('uses authenticated server-owned hint state for grading', async () => {
    const { api, record, revealHint, hintUsage } = controller();
    await expect(api.reveal('member-a', {
      taskId: 'sample.count', taskVersion: 1, idempotencyKey: 'request_12345678',
    })).resolves.toEqual({ text: 'A triangle has three corners.', hintsUsed: 1 });
    expect(revealHint).toHaveBeenCalledWith('member-a', 'sample.count', 1, 'request_12345678', 1);
    hintUsage.mockResolvedValue(1);
    await api.submit('member-a', request('sample.count', 3));
    expect(record).toHaveBeenCalledWith('member-a', expect.objectContaining({ hintsUsed: 1, correct: true }));
    await expect(api.submit('member-a', { ...request('sample.count', 3), hintsUsed: 0 }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects hints for tasks without hints', async () => {
    const { api, revealHint } = controller();
    await expect(api.reveal('member-a', {
      taskId: 'sample.color', taskVersion: 1, idempotencyKey: 'request_12345678',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(revealHint).not.toHaveBeenCalled();
  });

  it('reads attempt history for the authenticated member only', async () => {
    const { api, list } = controller();
    await api.history('member-a');
    expect(list).toHaveBeenCalledWith('member-a');
  });
});

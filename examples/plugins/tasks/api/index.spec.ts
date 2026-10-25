import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import plugin from './index';

function controller() {
  const record = vi.fn().mockImplementation(async (_memberId, input) => ({
    id: 'attempt-1', ...input,
  }));
  const list = vi.fn().mockResolvedValue([]);
  const registration = plugin.register({
    pluginId: 'tasks',
    CurrentUser: () => () => undefined,
    Roles: () => () => undefined,
    data: { tasks: { record, list }, journal: {} as never },
    contentPack: {} as never,
  });
  const ControllerType = registration.controllers![0] as new () => {
    tasks(): Array<Record<string, unknown>>;
    history(memberId: string): Promise<unknown>;
    submit(memberId: string, body: unknown): Promise<{ correct: boolean }>;
  };
  return { api: new ControllerType(), record, list };
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

  it('reads attempt history for the authenticated member only', async () => {
    const { api, list } = controller();
    await api.history('member-a');
    expect(list).toHaveBeenCalledWith('member-a');
  });
});

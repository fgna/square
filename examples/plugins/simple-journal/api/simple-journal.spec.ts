import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { PluginApiContext } from '@community/plugin-sdk/api';
import simpleJournal from './index';

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);
const record = (d: string, text: string) => ({ id: d, userId: 'u1', date: day(d), content: { text }, moods: [], createdAt: day(d), updatedAt: day(d) });

function setup(pack: Partial<PluginApiContext['contentPack']> = {}) {
  const journal = {
    list: vi.fn().mockResolvedValue([record('2026-10-21', 'today'), record('2026-10-20', '')]),
    get: vi.fn().mockResolvedValue(record('2026-10-21', 'today')),
    save: vi.fn(async (_u: string, d: string, e: { content: unknown }) => ({ ...record(d, ''), content: e.content })),
    remove: vi.fn(),
    dates: vi.fn(),
  };
  const contentPack = { source: () => 'legacy' as const, journalMethod: vi.fn().mockResolvedValue(null), journalTexts: vi.fn().mockResolvedValue(null), ...pack };
  const { controllers = [] } = simpleJournal.register({
    pluginId: 'journal',
    Roles: (...roles) => SetMetadata('roles', roles),
    CurrentUser: createParamDecorator(() => undefined),
    data: { journal },
    contentPack,
  });
  return { controller: new controllers[0](), journal };
}

describe('simple-journal plugin API', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-21T09:00:00.000Z'), toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it("returns today's note and no prompt without a content pack", async () => {
    const { controller, journal } = setup();
    expect(await controller.today('u1', 'en')).toEqual({ date: '2026-10-21', text: 'today', prompt: null });
    expect(journal.get).toHaveBeenCalledWith('u1', '2026-10-21');
  });

  it("takes the day's prompt from the pack, in the member's language", async () => {
    const method = { prompts: [{ id: 'a', categoryId: 'c', text: 'A', sortOrder: 0 }, { id: 'b', categoryId: 'c', text: 'B', sortOrder: 1 }] };
    const { controller } = setup({
      journalMethod: vi.fn().mockResolvedValue(method),
      journalTexts: vi.fn().mockResolvedValue({ fields: {}, categories: {}, prompts: { a: 'A (de)', b: 'B (de)' } }),
    });
    // 21 October is day 293 of the year (0-based), so prompt 293 % 2 = 1.
    expect((await controller.today('u1', 'de')).prompt).toBe('B (de)');
  });

  it('saves the note as { text } and refuses anything else', async () => {
    const { controller, journal } = setup();
    expect(await controller.save('u1', { text: 'Hello' })).toEqual({ date: '2026-10-21', text: 'Hello' });
    expect(journal.save).toHaveBeenCalledWith('u1', '2026-10-21', { content: { text: 'Hello' } });
    await expect(controller.save('u1', { text: 42 })).rejects.toThrow('text must be a string');
  });

  it('lists the last 30 days with text', async () => {
    const { controller, journal } = setup();
    expect(await controller.history('u1')).toEqual([{ date: '2026-10-21', text: 'today' }]);
    expect(journal.list).toHaveBeenCalledWith('u1', { from: '2026-09-21', to: '2026-10-22' });
  });
});

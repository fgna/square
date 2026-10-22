import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../../../prisma/prisma.service';
import { JournalService } from './journal.service';
import { JournalEntryStore } from '../../data/journal-entries.store';
import { ContentPackService } from '../../data/content-pack.service';

/** The service with the Core's entry store and content pack over the given Prisma stand-in. */
const journalService = (prisma: PrismaService) => new JournalService(prisma, new JournalEntryStore(prisma), new ContentPackService());

const originalSource = process.env.COMMUNITY_CONTENT_SOURCE;
const originalDir = process.env.COMMUNITY_CONTENT_DIR;
const roots: string[] = [];
afterEach(async () => {
  if (originalSource === undefined) delete process.env.COMMUNITY_CONTENT_SOURCE;
  else process.env.COMMUNITY_CONTENT_SOURCE = originalSource;
  if (originalDir === undefined) delete process.env.COMMUNITY_CONTENT_DIR;
  else process.env.COMMUNITY_CONTENT_DIR = originalDir;
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'journal-pack-test-'));
  roots.push(root);
  await mkdir(join(root, 'journal'));
  await writeFile(join(root, 'community.json'), JSON.stringify({
    schemaVersion: 1, id: 'neutral-example', version: '1.0.0',
    platformCompatibility: '^1.0.0', locales: ['en', 'de'],
    journal: { definition: 'journal/method.json' },
  }));
  const content = {
    version: 'demo-v1',
    categories: [{ id: 'notes', label: 'Neutral notes', color: '#123abc' }],
    prompts: [
      { id: 'first', categoryId: 'notes', text: 'Example reflection one', sortOrder: 0 },
      { id: 'second', categoryId: 'notes', text: 'Example reflection two', sortOrder: 1 },
    ],
    rotation: { promptsPerDay: 1, cycle: 'day-of-year' },
    fields: [{ key: 'notes', label: 'Notes', kind: 'text' }],
  };
  await writeFile(join(root, 'journal', 'method.json'), JSON.stringify(content));
  process.env.COMMUNITY_CONTENT_SOURCE = 'pack';
  process.env.COMMUNITY_CONTENT_DIR = root;
  return root;
}
describe('pack-managed journal read-only mode', () => {
  it('returns pack method, categories and questions without using DB rows', async () => {
    await setup();
    const findMany = vi.fn();
    const service = journalService({
      journalPrompt: { findMany },
      journalPromptCategory: { findMany },
    } as unknown as PrismaService);
    expect(await service.getMethodFields()).toEqual({
      source: 'pack', version: 'demo-v1',
      fields: [{ key: 'notes', label: 'Notes', kind: 'text' }],
    });
    expect((await service.getDailyPrompts())).toHaveLength(1);
    expect((await service.getCategories())[0].name).toBe('Neutral notes');
    expect((await service.getPrompts())).toHaveLength(2);
    expect(findMany).not.toHaveBeenCalled();
  });
  it('blocks journal admin writes before any DB modification', async () => {
    await setup();
    const create = vi.fn(), update = vi.fn(), remove = vi.fn();
    const service = journalService({
      journalPrompt: { create, update, delete: remove },
      journalPromptCategory: { create, update, delete: remove },
    } as unknown as PrismaService);
    await expect(service.createPrompt({} as never)).rejects.toThrow();
    await expect(service.updatePrompt('x', {} as never)).rejects.toThrow();
    await expect(service.deletePrompt('x')).rejects.toThrow();
    await expect(service.createCategory({} as never)).rejects.toThrow();
    await expect(service.updateCategory('x', {} as never)).rejects.toThrow();
    await expect(service.deleteCategory('x')).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it('pins the validated method across file edits', async () => {
    const root = await setup();
    const service = journalService({} as PrismaService);
    const original = await service.getMethodFields();
    await writeFile(join(root, 'journal', 'method.json'), '{ invalid json');
    expect(await service.getMethodFields()).toEqual(original);
  });
  it('fails closed if the journal section is not valid', async () => {
    const root = await setup();
    await writeFile(join(root, 'journal', 'method.json'), '{"version":"invalid"}');
    const service = journalService({} as PrismaService);
    await expect(service.getDailyPrompts()).rejects.toThrow();
  });
  it('accepts typed pack fields without sending fixed legacy fields', async () => {
    await setup();
    const upsert = vi.fn().mockResolvedValue({ id: 'saved' });
    const service = journalService({
      journalEntry: { upsert },
    } as unknown as PrismaService);
    const actual = await service.upsertPackEntry('user-1', '2026-10-11', { content: { notes: 'Example text' } });
    expect(actual).toEqual({ id: 'saved' });
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0].create.content).toEqual({ notes: 'Example text' });
    expect(upsert.mock.calls[0][0].create.userId).toBe('user-1');
  });
  it('blocks method field mismatch, extra fields and malformed values', async () => {
    await setup();
    const upsert = vi.fn();
    const service = journalService({
      journalEntry: { upsert },
    } as unknown as PrismaService);
    for (const content of [{}, { notes: 123 }, { notes: 'fine', private: 'extra' }]) {
      await expect(service.upsertPackEntry('user-1', '2026-10-11', { content })).rejects.toThrow();
    }
    await expect(service.upsertPackEntry('user-1', 'not-a-date', { content: { notes: 'text' } })).rejects.toThrow();
    await expect(service.upsertPackEntry('user-1', '2026-10-11', { content: { notes: 'x'.repeat(10001) } })).rejects.toThrow();
    await expect(service.upsert('user-1', '2026-10-11', {} as never)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  it('rejects pack endpoint writes when using legacy mode', async () => {
    delete process.env.COMMUNITY_CONTENT_SOURCE;
    const upsert = vi.fn();
    const service = journalService({ journalEntry: { upsert } } as unknown as PrismaService);
    await expect(service.upsertPackEntry('user', '2026-10-11', { content: { notes: 'x' } })).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  it('preserves legacy DB questions when pack mode is not active', async () => {
    delete process.env.COMMUNITY_CONTENT_SOURCE;
    const findMany = vi.fn().mockResolvedValue([]);
    const service = journalService({
      journalPrompt: { findMany },
    } as unknown as PrismaService);
    expect(await service.getDailyPrompts()).toEqual([]);
    expect(findMany).toHaveBeenCalledOnce();
  });
});

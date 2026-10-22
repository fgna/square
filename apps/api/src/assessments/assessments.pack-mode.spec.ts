import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';

const roots: string[] = [];
const originalSource = process.env.COMMUNITY_CONTENT_SOURCE;
const originalDir = process.env.COMMUNITY_CONTENT_DIR;
afterEach(async () => {
  if (originalSource === undefined) delete process.env.COMMUNITY_CONTENT_SOURCE;
  else process.env.COMMUNITY_CONTENT_SOURCE = originalSource;
  if (originalDir === undefined) delete process.env.COMMUNITY_CONTENT_DIR;
  else process.env.COMMUNITY_CONTENT_DIR = originalDir;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setupPack(instrumentVersion = 'generic-v1') {
  const root = await mkdtemp(join(tmpdir(), 'instrument-'));
  roots.push(root);
  await mkdir(join(root, 'assessments'));
  await writeFile(join(root, 'community.json'), JSON.stringify({
    schemaVersion: 1, id: 'example-community', version: '1.0.0',
    platformCompatibility: '^1.0.0', locales: ['en'],
    assessment: { instrumentId: 'example', instrumentVersion, definition: 'assessments/test.json' },
  }));
  await writeFile(join(root, 'assessments/test.json'), JSON.stringify({
    instrumentId: 'example', instrumentVersion, dimensions: ['A', 'B'],
    minimumAnswersPerDimension: 2, recommendationCategories: { A: ['alpha'], B: ['beta'] },
    questions: ['A1','A2','B1','B2'].map((id) => ({
      id, dimension: id[0], text: 'Question ' + id,
    })),
  }));
  process.env.COMMUNITY_CONTENT_SOURCE = 'pack';
  process.env.COMMUNITY_CONTENT_DIR = root;
}

describe('issue #191 optional assessment pack', () => {
  it('uses a generic instrument only with explicit opt-in, preserving version and scoring snapshots', async () => {
    await setupPack();
    const prisma = {
      assessmentQuestion: { findMany: vi.fn() },
      assessment: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data) },
    };
    const service = new AssessmentsService(prisma as unknown as PrismaService);
    expect((await service.getQuestions()).dimensions.map((d) => d.key)).toEqual(['A', 'B']);
    const result = await service.submit('member', {
      answers: [{ questionId: 'A1', score: 5 }, { questionId: 'A2', score: 3 },
        { questionId: 'B1', score: 2 }, { questionId: 'B2', score: null }],
    });
    expect(result.instrumentVersion).toBe('generic-v1');
    expect(result.scores).toEqual({ A: 4, B: null });
    expect(result.overallScore).toBeNull();
    const stored = prisma.assessment.create.mock.calls[0][0].data as { answers: { create: Array<Record<string, unknown>> } };
    expect(stored.answers.create[0]).toMatchObject({ questionId: 'A1', dimension: 'A', text: 'Question A1' });
    expect(prisma.assessmentQuestion.findMany).not.toHaveBeenCalled();
  });
  it('rejects mismatched manifest and instrument versions before persisting answers', async () => {
    await setupPack('expected-v1');
    const root = process.env.COMMUNITY_CONTENT_DIR!;
    await writeFile(join(root, 'assessments/test.json'), JSON.stringify({
      instrumentId: 'example', instrumentVersion: 'wrong-v1', dimensions: ['A'],
      minimumAnswersPerDimension: 1, recommendationCategories: { A: [] },
      questions: [{ id: 'a1', dimension: 'A', text: 'Sample' }],
    }));
    const create = vi.fn();
    const service = new AssessmentsService({ assessment: { create } } as unknown as PrismaService);
    await expect(service.submit('member', { answers: [{ questionId: 'a1', score: 3 }] }))
      .rejects.toThrow('identity mismatch');
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects a bad definition rather than falling back to legacy', async () => {
    await setupPack();
    const root = process.env.COMMUNITY_CONTENT_DIR!;
    await writeFile(join(root, 'assessments/test.json'), JSON.stringify({ invalid: true }));
    const findMany = vi.fn();
    const service = new AssessmentsService({
      assessmentQuestion: { findMany },
    } as unknown as PrismaService);
    await expect(service.getQuestions()).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('keeps the original validated definition after on-disk changes', async () => {
    await setupPack();
    const service = new AssessmentsService({
      assessmentQuestion: { findMany: vi.fn() },
    } as unknown as PrismaService);
    const first = await service.getQuestions();
    const root = process.env.COMMUNITY_CONTENT_DIR!;
    await writeFile(join(root, 'assessments/test.json'), JSON.stringify({ invalid: true }));
    const second = await service.getQuestions();
    expect(second).toEqual(first);
  });
  it('does not retry an invalid pack as legacy after the first failure', async () => {
    await setupPack();
    const root = process.env.COMMUNITY_CONTENT_DIR!;
    await writeFile(join(root, 'assessments/test.json'), JSON.stringify({ invalid: true }));
    const findMany = vi.fn();
    const service = new AssessmentsService({
      assessmentQuestion: { findMany },
    } as unknown as PrismaService);
    await expect(service.getQuestions()).rejects.toThrow();
    await expect(service.getQuestions()).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects unsupported mode instead of silently switching to legacy', async () => {
    process.env.COMMUNITY_CONTENT_SOURCE = 'pak';
    const findMany = vi.fn();
    const service = new AssessmentsService({
      assessmentQuestion: { findMany },
    } as unknown as PrismaService);
    await expect(service.getQuestions()).rejects.toThrow('COMMUNITY_CONTENT_DIR');
    expect(service.isPackManaged()).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });
  it('fails closed if pack is selected but missing', async () => {
    process.env.COMMUNITY_CONTENT_SOURCE = 'pack';
    delete process.env.COMMUNITY_CONTENT_DIR;
    const service = new AssessmentsService({} as PrismaService);
    await expect(service.getQuestions()).rejects.toThrow('COMMUNITY_CONTENT_DIR');
  });
  it('fails closed when no content package is selected', async () => {
    delete process.env.COMMUNITY_CONTENT_SOURCE;
    delete process.env.COMMUNITY_CONTENT_DIR;
    const findMany = vi.fn();
    const service = new AssessmentsService({
      assessmentQuestion: { findMany },
    } as unknown as PrismaService);
    await expect(service.getQuestions()).rejects.toThrow('COMMUNITY_CONTENT_DIR');
    expect(findMany).not.toHaveBeenCalled();
  });
});

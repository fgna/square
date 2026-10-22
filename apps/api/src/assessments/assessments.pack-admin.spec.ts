import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssessmentsController } from './assessments.controller';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';

const original = process.env.COMMUNITY_CONTENT_SOURCE;
const originalDir = process.env.COMMUNITY_CONTENT_DIR;
const temporaryRoots: string[] = [];
afterEach(async () => {
  if (original === undefined) delete process.env.COMMUNITY_CONTENT_SOURCE;
  else process.env.COMMUNITY_CONTENT_SOURCE = original;
  if (originalDir === undefined) delete process.env.COMMUNITY_CONTENT_DIR;
  else process.env.COMMUNITY_CONTENT_DIR = originalDir;
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('pack-managed assessment admin safety', () => {
  it('enforces RolesGuard for every role-marked admin endpoint', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AssessmentsController) as unknown[];
    expect(guards).toContain(RolesGuard);
    for (const method of ['getAdminMode', 'getAdminPackIdentity', 'getAdminQuestions', 'createQuestion', 'updateQuestion', 'deleteQuestion'] as const) {
      expect(Reflect.getMetadata(ROLES_KEY, AssessmentsController.prototype[method])).toEqual(['ADMIN']);
    }
  });

  it('rejects all DB question writes when pack mode is active', async () => {
    process.env.COMMUNITY_CONTENT_SOURCE = 'pack';
    const create = vi.fn(), update = vi.fn(), remove = vi.fn();
    const service = new AssessmentsService({
      assessmentQuestion: { create, update, delete: remove },
    } as unknown as PrismaService);
    expect(service.isPackManaged()).toBe(true);
    expect(() => service.createQuestion({ questionId: 'a', dimension: 'A', text: 'x' } )).toThrow(BadRequestException);
    expect(() => service.updateQuestion('a', { text: 'x' })).toThrow(BadRequestException);
    expect(() => service.deleteQuestion('a')).toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('lists active pack questions without reading stale DB questions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'readonly-assessment-'));
    temporaryRoots.push(root);
    await mkdir(join(root, 'assessments'));
    await writeFile(join(root, 'community.json'), JSON.stringify({
      schemaVersion: 1, id: 'sample-community', version: '1.0.0',
      platformCompatibility: '^1.0.0', locales: ['en'],
      assessment: { instrumentId: 'sample', instrumentVersion: 'v1', definition: 'assessments/sample.json' },
    }));
    await writeFile(join(root, 'assessments/sample.json'), JSON.stringify({
      instrumentId: 'sample', instrumentVersion: 'v1',
      dimensions: ['A'], minimumAnswersPerDimension: 1,
      questions: [{ id: 'a1', dimension: 'A', text: 'Pack question' }],
      recommendationCategories: { A: [] },
    }));
    process.env.COMMUNITY_CONTENT_SOURCE = 'pack';
    process.env.COMMUNITY_CONTENT_DIR = root;
    const findMany = vi.fn();
    const service = new AssessmentsService({
      assessmentQuestion: { findMany },
    } as unknown as PrismaService);
    expect(await service.getAdminQuestions()).toEqual([{
      id: 'a1', questionId: 'a1', dimension: 'A', text: 'Pack question',
      sortOrder: 0, isActive: true,
    }]);
    expect(await service.getPackIdentity()).toEqual({
      instrumentId: 'sample', instrumentVersion: 'v1',
    });
    expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects database question writes even when no content pack is configured', () => {
    delete process.env.COMMUNITY_CONTENT_SOURCE;
    const create = vi.fn(), update = vi.fn(), remove = vi.fn();
    const service = new AssessmentsService({
      assessmentQuestion: { create, update, delete: remove },
    } as unknown as PrismaService);
    expect(service.isPackManaged()).toBe(true);
    expect(() => service.createQuestion({ questionId: 'a', dimension: 'A', text: 'x' })).toThrow(BadRequestException);
    expect(() => service.updateQuestion('a', { text: 'x' })).toThrow(BadRequestException);
    expect(() => service.deleteQuestion('a')).toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

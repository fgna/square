import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { CanActivate, ExecutionContext, ForbiddenException, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { GlobalExceptionFilter } from '../../../common/filters/http-exception.filter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PluginsModule } from '../../plugins.module';
import journal from './index';

/**
 * Golden test: records status, body and database calls of a fixed set of
 * journal requests, in legacy and in pack mode, and compares them with
 * __golden__/journal-api.json. Moving the journal must not change this file;
 * only BASE may change with the route. Regenerate deliberately with `vitest -u`.
 */
const BASE = '/api/p/journal';
const NOW = new Date('2026-10-21T10:00:00.000Z');
const PACK_DIR = resolve(__dirname, '../../../../../../examples/neutral-method-pack');

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const entry = (id: string, date: string) => ({
  id,
  userId: 'member-1',
  date: day(date),
  content: { thoughts: `entry ${date}` },
  moods: ['calm'],
  createdAt: day(date),
  updatedAt: day(date),
});
const category = (id: string, name: string, sortOrder: number) => ({ id, name, color: '#8b5cf6', isActive: true, sortOrder });
const prompt = (id: string, cat: ReturnType<typeof category>, sortOrder: number) => ({
  id,
  text: `Prompt ${id}`,
  categoryId: cat.id,
  isActive: true,
  sortOrder,
  category: { id: cat.id, name: cat.name, color: cat.color },
});
const categories = [category('c1', 'Morning', 0), category('c2', 'Evening', 1)];
const prompts = [prompt('p1', categories[0], 0), prompt('p2', categories[1], 1), prompt('p3', categories[0], 2), prompt('p4', categories[1], 3)];
const entries = ['2026-10-21', '2026-10-20', '2026-10-19', '2026-10-15', '2026-09-30'].map((d, i) => entry(`e${i + 1}`, d));

/** Prisma stand-in that answers from fixed data and records every call. */
function recordingPrisma(calls: unknown[]) {
  const answers: Record<string, (args: any) => unknown> = {
    'journalEntry.findMany': (args) => (args?.select ? entries.map(({ date }) => ({ date })) : entries),
    'journalEntry.findUnique': (args) => entries.find((e) => e.date.getTime() === args.where.userId_date.date.getTime()) ?? null,
    'journalEntry.upsert': (args) => ({ id: 'e-new', ...args.create, createdAt: NOW, updatedAt: NOW }),
    'journalEntry.delete': (args) => ({ id: args.where.id }),
    'journalPrompt.findMany': () => prompts,
    'journalPrompt.create': (args) => ({ id: 'p-new', isActive: true, sortOrder: 0, ...args.data, category: { id: args.data.categoryId, name: 'Morning', color: '#8b5cf6' } }),
    'journalPrompt.update': (args) => ({ ...prompts[0], ...args.data }),
    'journalPrompt.delete': (args) => ({ id: args.where.id }),
    'journalPromptCategory.findMany': () => categories.map((c) => ({ ...c, _count: { prompts: 2 } })),
    'journalPromptCategory.create': (args) => ({ id: 'c-new', color: '#8b5cf6', isActive: true, sortOrder: 0, ...args.data }),
    'journalPromptCategory.update': (args) => ({ ...categories[0], ...args.data }),
    'journalPromptCategory.delete': (args) => ({ id: args.where.id }),
  };
  return new Proxy({} as Record<string, unknown>, {
    get: (_, model: string) =>
      new Proxy({}, {
        get: (__, method: string) => async (args: unknown) => {
          const key = `${model}.${method}`;
          calls.push({ call: key, args });
          if (!answers[key]) throw new Error(`unexpected prisma call ${key}`);
          return answers[key](args);
        },
      }),
  });
}

// Stands in for the JWT guard: the member comes from a test header.
@Injectable()
class HeaderUserGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!req.headers['x-test-role']) throw new ForbiddenException();
    req.user = { id: req.headers['x-test-role'] === 'ADMIN' ? 'admin-1' : 'member-1', role: req.headers['x-test-role'] };
    return true;
  }
}

type Step = { method: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string; role?: 'MEMBER' | 'ADMIN'; body?: unknown };

const validEntry = {
  content: {
    threeGoals: ['one', 'two'],
    mustDoTasks: [{ text: 'call', done: false }],
    whoIWantToBe: 'calm',
    lookingForwardTo: 'lunch',
    importantPeople: 'team',
    thoughts: 'fine',
  },
  moods: ['grateful', 'tired'],
};

const legacySteps: Step[] = [
  { method: 'get', path: '' },
  { method: 'get', path: '?month=2026-10' },
  { method: 'get', path: '?month=2026-13' },
  { method: 'get', path: '/method' },
  { method: 'get', path: '/method?locale=de' },
  { method: 'get', path: '/prompts' },
  { method: 'get', path: '/stats' },
  { method: 'get', path: '/2026-10-20' },
  { method: 'get', path: '/2026-10-18' },
  { method: 'get', path: '/20261020' },
  { method: 'put', path: '/2026-10-21', body: validEntry },
  { method: 'put', path: '/2026-10-21', body: { ...validEntry, moods: ['bored'] } },
  { method: 'put', path: '/2026-10-21', body: { ...validEntry, extra: true } },
  { method: 'put', path: '/2026-10-21', body: { content: { ...validEntry.content, threeGoals: ['a', 'b', 'c', 'd'] } } },
  { method: 'put', path: '/method-entry/2026-10-21', body: { content: { notes: 'x' } } },
  { method: 'delete', path: '/2026-10-20' },
  { method: 'delete', path: '/2026-10-18' },
  { method: 'get', path: '/admin/categories' },
  { method: 'get', path: '/admin/categories', role: 'ADMIN' },
  { method: 'post', path: '/admin/categories', role: 'ADMIN', body: { name: 'Noon', color: '#123456' } },
  { method: 'post', path: '/admin/categories', role: 'ADMIN', body: { name: 'Noon', color: 'blue' } },
  { method: 'patch', path: '/admin/categories/c1', role: 'ADMIN', body: { isActive: false } },
  { method: 'delete', path: '/admin/categories/c2', role: 'ADMIN' },
  { method: 'get', path: '/admin/prompts?categoryId=c1', role: 'ADMIN' },
  { method: 'post', path: '/admin/prompts', role: 'ADMIN', body: { text: 'New prompt', categoryId: 'c1' } },
  { method: 'patch', path: '/admin/prompts/p1', role: 'ADMIN', body: { sortOrder: 5 } },
  { method: 'delete', path: '/admin/prompts/p1', role: 'ADMIN' },
  { method: 'delete', path: '/admin/prompts/p1' },
];

const packSteps: Step[] = [
  { method: 'get', path: '/method' },
  { method: 'get', path: '/method?locale=de' },
  { method: 'get', path: '/method?locale=fr' },
  { method: 'get', path: '/prompts?locale=en' },
  { method: 'get', path: '/admin/categories', role: 'ADMIN' },
  { method: 'get', path: '/admin/prompts', role: 'ADMIN' },
  { method: 'post', path: '/admin/categories', role: 'ADMIN', body: { name: 'Noon' } },
  { method: 'delete', path: '/admin/prompts/p1', role: 'ADMIN' },
  { method: 'put', path: '/2026-10-21', body: validEntry },
  { method: 'put', path: '/method-entry/2026-10-21', body: { content: { wrong: 'field' } } },
  { method: 'get', path: '/2026-10-20' },
];

async function record(steps: Step[], packFields?: () => Promise<Record<string, unknown>>) {
  const calls: unknown[] = [];
  // PrismaModule is global in the app; a global stand-in plays its part.
  const prisma = { module: class FakePrismaModule {}, global: true, providers: [{ provide: PrismaService, useValue: recordingPrisma(calls) }], exports: [PrismaService] };
  const moduleRef = await Test.createTestingModule({
    imports: [prisma, PluginsModule.register([{ id: 'journal', plugin: journal }])],
    providers: [
      { provide: APP_GUARD, useClass: HeaderUserGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();

  const transcript: unknown[] = [];
  try {
    if (packFields) steps = [...steps, { method: 'put', path: '/method-entry/2026-10-21', body: { content: await packFields() } }];
    for (const step of steps) {
      calls.length = 0;
      const req = request(app.getHttpServer())[step.method](BASE + step.path).set('x-test-role', step.role ?? 'MEMBER');
      const res = step.body === undefined ? await req : await req.send(step.body as object);
      // Error bodies carry the URL; keep the record independent of the route.
      const body = JSON.parse(JSON.stringify(res.body).split(BASE).join('<base>'));
      transcript.push({ request: `${step.method.toUpperCase()} <base>${step.path}`, role: step.role ?? 'MEMBER', status: res.status, body, db: JSON.parse(JSON.stringify(calls)) });
    }
  } finally {
    await app.close();
  }
  return transcript;
}

describe('journal API golden record', () => {
  const env = { source: process.env.COMMUNITY_CONTENT_SOURCE, dir: process.env.COMMUNITY_CONTENT_DIR, tz: process.env.TZ };
  beforeAll(() => {
    // The streak counts local days; the record is taken in UTC wherever it runs.
    process.env.TZ = 'UTC';
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });
  afterAll(() => {
    vi.useRealTimers();
    if (env.tz === undefined) delete process.env.TZ;
    else process.env.TZ = env.tz;
    process.env.COMMUNITY_CONTENT_SOURCE = env.source;
    process.env.COMMUNITY_CONTENT_DIR = env.dir;
    if (env.source === undefined) delete process.env.COMMUNITY_CONTENT_SOURCE;
    if (env.dir === undefined) delete process.env.COMMUNITY_CONTENT_DIR;
  });

  it('answers as recorded', async () => {
    delete process.env.COMMUNITY_CONTENT_SOURCE;
    delete process.env.COMMUNITY_CONTENT_DIR;
    const legacy = await record(legacySteps);

    process.env.COMMUNITY_CONTENT_SOURCE = 'pack';
    process.env.COMMUNITY_CONTENT_DIR = PACK_DIR;
    // A valid entry for whatever fields the sample pack defines.
    const pack = await record(packSteps, async () => {
      const def = JSON.parse(await (await import('node:fs/promises')).readFile(resolve(PACK_DIR, 'journal/definition.json'), 'utf8'));
      return Object.fromEntries(def.fields.map((f: { key: string; kind: string }) =>
        [f.key, f.kind === 'text' ? 'text' : f.kind === 'text-list' ? ['one'] : [{ text: 'task', done: true }]]));
    });

    await expect(JSON.stringify({ legacy, pack }, null, 2) + '\n').toMatchFileSnapshot('./__golden__/journal-api.json');
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Controller, ForbiddenException, Get, INestApplication, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { ApiPlugin } from '@community/plugin-sdk/api';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { instanceCapabilities, type Capability } from '../config/capabilities';
import { CapabilityGuard } from '../config/capabilities.guard';
import { PluginsModule } from './plugins.module';

// Stands in for the JWT guard: the member comes from a test header.
@Injectable()
class HeaderUserGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!req.headers['x-test-user']) throw new ForbiddenException();
    req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] ?? 'MEMBER' };
    return true;
  }
}

// PrismaModule is global in the app; a global stand-in plays its part.
const findUnique = vi.fn();
const findGroups = vi.fn();
const prisma = { journalEntry: { findUnique }, learningGroup: { findMany: findGroups } };
const fakePrisma = {
  module: class FakePrismaModule {},
  global: true,
  providers: [{ provide: PrismaService, useValue: prisma }],
  exports: [PrismaService],
};

const samplePlugin: ApiPlugin = {
  register({ pluginId, Roles, CurrentUser, data, contentPack }) {
    @Controller()
    class SampleController {
      @Get('hello')
      hello(@CurrentUser('id') userId: string) {
        return { pluginId, userId };
      }

      @Get('today')
      async today(@CurrentUser('id') userId: string) {
        return { source: contentPack.source(), entry: await data.journal.get(userId, '2026-10-21') };
      }

      @Get('groups')
      groups(@CurrentUser('id') userId: string) {
        return data.groups.list(userId);
      }

      @Get('admin')
      @Roles('ADMIN')
      admin() {
        return { ok: true };
      }
    }
    return { controllers: [SampleController] };
  },
};

describe('PluginsModule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [fakePrisma, PluginsModule.register([{ id: 'sample-plugin', plugin: samplePlugin }])],
      providers: [
        { provide: APP_GUARD, useClass: HeaderUserGuard },
        { provide: APP_GUARD, useClass: CapabilityGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).overrideProvider(PrismaService).useValue(prisma).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app.close());

  it('mounts plugin routes under /api/p/<id> and hands the plugin the signed-in member', async () => {
    const res = await request(app.getHttpServer()).get('/api/p/sample-plugin/hello').set('x-test-user', 'u1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pluginId: 'sample-plugin', userId: 'u1' });
  });

  it('gives plugins the journal entries and the content pack through the context', async () => {
    findUnique.mockResolvedValue({ id: 'e1', content: { text: 'hi' } });
    const res = await request(app.getHttpServer()).get('/api/p/sample-plugin/today').set('x-test-user', 'u1');
    expect(res.body).toEqual({ source: 'legacy', entry: { id: 'e1', content: { text: 'hi' } } });
    expect(findUnique).toHaveBeenCalledWith({ where: { userId_date: { userId: 'u1', date: new Date('2026-10-21T00:00:00.000Z') } } });
  });

  it('uses the authenticated member for plugin group queries and enforces the capability', async () => {
    const capabilities = instanceCapabilities as Set<Capability>;
    const previouslyEnabled = capabilities.has('learning-groups');
    const server = app.getHttpServer();
    const path = '/api/p/sample-plugin/groups';
    try {
      capabilities.add('learning-groups');
      findGroups.mockResolvedValue([{ id: 'member-group' }]);
      await request(server).get(path).expect(403);
      await request(server).get(path).query({ userId: 'other' }).set('x-test-user', 'member').expect(200, [{ id: 'member-group' }]);
      expect(findGroups).toHaveBeenCalledTimes(1);
      expect(findGroups).toHaveBeenCalledWith(expect.objectContaining({
        where: { members: { some: { userId: 'member' } } },
      }));

      capabilities.delete('learning-groups');
      await request(server).get(path).set('x-test-user', 'member').expect(404);
      await request(server).get('/api/learning-groups').set('x-test-user', 'member').expect(404);
      expect(findGroups).toHaveBeenCalledTimes(1);
    } finally {
      if (previouslyEnabled) capabilities.add('learning-groups');
      else capabilities.delete('learning-groups');
    }
  });

  it('applies the global guards to plugin routes', async () => {
    expect((await request(app.getHttpServer()).get('/api/p/sample-plugin/hello')).status).toBe(403);
  });

  it('restricts routes marked with Roles()', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/api/p/sample-plugin/admin').set('x-test-user', 'u1')).status).toBe(403);
    expect((await request(server).get('/api/p/sample-plugin/admin').set('x-test-user', 'a1').set('x-test-role', 'ADMIN')).status).toBe(200);
  });

  it('does not serve plugin routes outside their prefix', async () => {
    expect((await request(app.getHttpServer()).get('/api/hello').set('x-test-user', 'u1')).status).toBe(404);
  });

  it('registers nothing when no plugin is installed', async () => {
    const empty = await Test.createTestingModule({ imports: [fakePrisma, PluginsModule.register([])] }).overrideProvider(PrismaService).useValue(prisma).compile();
    const a = empty.createNestApplication();
    await a.init();
    await a.close();
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Controller, ForbiddenException, Get, INestApplication, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { ApiPlugin } from '@community/plugin-sdk/api';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
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
const fakePrisma = {
  module: class FakePrismaModule {},
  global: true,
  providers: [{ provide: PrismaService, useValue: { journalEntry: { findUnique } } }],
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
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
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
    const empty = await Test.createTestingModule({ imports: [fakePrisma, PluginsModule.register([])] }).compile();
    const a = empty.createNestApplication();
    await a.init();
    await a.close();
  });
});

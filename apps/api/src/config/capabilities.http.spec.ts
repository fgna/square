import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

@Controller()
class TestRoutes {
  @Get('auth/login') login() { return { ok: true }; }
  @Get('gamification/wallet') wallet() { return { balance: 999 }; }
  @Post('gamification/admin/events') reward() { return { awarded: true }; }
  @Get('courses') courses() { return []; }
}

describe('disabled capabilities are enforced over HTTP', () => {
  let app: INestApplication;
  const previous = process.env.SQUARE_CAPABILITIES;

  beforeAll(async () => {
    process.env.SQUARE_CAPABILITIES = 'courses';
    vi.resetModules();
    const { CapabilityGuard } = await import('./capabilities.guard');
    const module = await Test.createTestingModule({ controllers: [TestRoutes] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new CapabilityGuard());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.SQUARE_CAPABILITIES;
    else process.env.SQUARE_CAPABILITIES = previous;
    vi.resetModules();
  });

  it('denies both member and admin gamification endpoints directly', async () => {
    await request(app.getHttpServer()).get('/api/gamification/wallet').expect(404);
    await request(app.getHttpServer()).post('/api/gamification/admin/events').send({}).expect(404);
  });

  it('preserves explicitly allowed courses and baseline identity', async () => {
    await request(app.getHttpServer()).get('/api/courses').expect(200);
    await request(app.getHttpServer()).get('/api/auth/login').expect(200);
  });
});

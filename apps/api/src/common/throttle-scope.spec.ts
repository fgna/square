import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { onlyWhereDeclared } from './throttle-scope';

@Controller()
class TestController {
  @Get('poll')
  poll() {
    return 'ok';
  }

  @Get('login')
  @Throttle({ auth: { limit: 3, ttl: 900_000 } })
  login() {
    return 'ok';
  }
}

describe('auth throttler scope', () => {
  let app: INestApplication;
  afterEach(() => app?.close());

  async function start() {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: 1000 },
          { name: 'auth', ttl: 900_000, limit: 60, skipIf: onlyWhereDeclared('auth') },
        ]),
      ],
      controllers: [TestController],
      providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    return request(app.getHttpServer());
  }

  it('does not limit routes that do not declare it (e.g. chat polling every 5 s)', async () => {
    const http = await start();
    // More than the 60 requests per 15 minutes the "auth" throttler allows.
    for (let i = 0; i < 80; i++) await http.get('/poll').expect(200);
  });

  it('still limits the routes that declare it', async () => {
    const http = await start();
    for (let i = 0; i < 3; i++) await http.get('/login').expect(200);
    await http.get('/login').expect(429);
  });
});

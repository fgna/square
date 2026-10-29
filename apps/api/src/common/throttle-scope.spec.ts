import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
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

  @Get('auth/refresh')
  @Throttle({ auth: { limit: 3, ttl: 900_000 } })
  refresh() {
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
    app.use(cookieParser());
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

  it('counts token refreshes per signed-in user, not per proxy address', async () => {
    process.env.JWT_REFRESH_SECRET = 'spec-refresh-secret';
    const jwt = new JwtService({ secret: 'spec-refresh-secret' });
    const cookie = (sub: string) => `refresh_token=${jwt.sign({ sub, jti: Math.random().toString(36) })}`;
    const http = await start();
    // Everyone arrives from the same proxy address in this test.
    for (let i = 0; i < 3; i++) await http.get('/auth/refresh').set('Cookie', cookie('user-a')).expect(200);
    await http.get('/auth/refresh').set('Cookie', cookie('user-a')).expect(429);
    await http.get('/auth/refresh').set('Cookie', cookie('user-b')).expect(200);
  });

  it('a refresh cookie never moves login or registration off the address limit', async () => {
    process.env.JWT_REFRESH_SECRET = 'spec-refresh-secret';
    const jwt = new JwtService({ secret: 'spec-refresh-secret' });
    const http = await start();
    // Like chaining sign-ups: every request carries a different, validly signed cookie.
    for (let i = 0; i < 3; i++) await http.get('/login').set('Cookie', `refresh_token=${jwt.sign({ sub: 'new-' + i })}`).expect(200);
    await http.get('/login').set('Cookie', `refresh_token=${jwt.sign({ sub: 'new-9' })}`).expect(429);
  });

  it('a forged refresh cookie does not escape the address limit', async () => {
    process.env.JWT_REFRESH_SECRET = 'spec-refresh-secret';
    const forged = new JwtService({ secret: 'wrong-secret' });
    const http = await start();
    for (let i = 0; i < 3; i++) {
      await http.get('/auth/refresh').set('Cookie', `refresh_token=${forged.sign({ sub: 'u' + i })}`).expect(200);
    }
    await http.get('/auth/refresh').set('Cookie', `refresh_token=${forged.sign({ sub: 'u9' })}`).expect(429);
  });
});

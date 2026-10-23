import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { RolesGuard } from '../auth/guards/roles.guard';

/** HTTP route/role checks; the test middleware supplies a trusted identity like JWT auth does. */
describe('gamification HTTP access control', () => {
  let app: INestApplication;
  const game = {
    wallet: vi.fn(async (userId: string) => ({ userId, balance: 10 })),
    history: vi.fn(async () => []),
    inventory: vi.fn(async () => []),
    items: vi.fn(async () => []),
    purchase: vi.fn(async (userId: string) => ({ userId, duplicate: false })),
    defineReward: vi.fn(async () => ({ amount: 10 })),
    issueReward: vi.fn(async () => ({ duplicate: false })),
    defineItem: vi.fn(async () => ({ price: 1 })),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [{ provide: GamificationService, useValue: game }, RolesGuard],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: { user?: { id: string; role: string }; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      if (req.headers['x-test-identity'] === 'member') req.user = { id: 'member-1', role: 'MEMBER' };
      if (req.headers['x-test-identity'] === 'admin') req.user = { id: 'admin-1', role: 'ADMIN' };
      next();
    });
    app.useGlobalGuards(module.get(RolesGuard));
    await app.init();
  });
  afterAll(async () => { await app?.close(); });

  it('returns 403 on admin operations without an admin identity', async () => {
    for (const path of ['admin/rewards', 'admin/events', 'admin/items']) {
      await request(app.getHttpServer()).post('/api/gamification/' + path)
        .set('x-test-identity', 'member').send({}).expect(403);
      await request(app.getHttpServer()).post('/api/gamification/' + path).send({}).expect(403);
    }
    expect(game.issueReward).not.toHaveBeenCalled();
    expect(game.defineItem).not.toHaveBeenCalled();
  });

  it('allows trusted admin identity to issue rewards', async () => {
    await request(app.getHttpServer()).post('/api/gamification/admin/events')
      .set('x-test-identity', 'admin').send({ userId: 'member-1', rewardCode: 'welcome', eventKey: 'e1' }).expect(201);
    expect(game.issueReward).toHaveBeenCalledWith('member-1', 'welcome', 'e1');
  });

  it('derives the wallet and purchase owner from identity rather than the request body', async () => {
    const wallet = await request(app.getHttpServer()).get('/api/gamification/wallet')
      .set('x-test-identity', 'member').expect(200);
    expect(wallet.body.userId).toBe('member-1');
    await request(app.getHttpServer()).post('/api/gamification/purchase')
      .set('x-test-identity', 'member')
      .send({ userId: 'victim', itemId: 'badge', requestKey: 'p1' }).expect(201);
    expect(game.purchase).toHaveBeenCalledWith('member-1', 'badge', 'p1');
  });
});

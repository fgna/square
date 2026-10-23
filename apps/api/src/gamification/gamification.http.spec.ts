import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import request from 'supertest';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { RolesGuard } from '../auth/guards/roles.guard';

/** HTTP route/role checks; issues real signed JWTs and checks Passport JwtStrategy and RolesGuard. */
describe('gamification HTTP access control', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const previousSecret = process.env.JWT_SECRET;
  const secret = 'gamification-http-test-secret-123456789';
  const token = (id: string, role: string) => jwt.sign({ sub: id, email: id + '@example.test', role });
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
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret })],
      controllers: [GamificationController],
      providers: [
        { provide: GamificationService, useValue: game },
        { provide: PrismaService, useValue: { user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, role: where.id.startsWith('admin') ? 'ADMIN' : 'MEMBER', isActive: true })) } } },
        JwtStrategy, JwtAuthGuard, RolesGuard,
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    jwt = module.get(JwtService);
    app.useGlobalGuards(module.get(JwtAuthGuard), module.get(RolesGuard));
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('returns 403 on admin operations without an admin identity', async () => {
    for (const path of ['admin/rewards', 'admin/events', 'admin/items']) {
      await request(app.getHttpServer()).post('/api/gamification/' + path)
        .set('Authorization', 'Bearer ' + token('member-1', 'MEMBER')).send({}).expect(403);
      await request(app.getHttpServer()).post('/api/gamification/' + path).send({}).expect(401);
    }
    expect(game.issueReward).not.toHaveBeenCalled();
    expect(game.defineItem).not.toHaveBeenCalled();
  });

  it('rejects invalid JWT tokens before reaching protected endpoints', async () => {
    await request(app.getHttpServer()).get('/api/gamification/wallet')
      .set('Authorization', 'Bearer invalid').expect(401);
  });

  it('allows verified admin JWT identity to issue rewards', async () => {
    await request(app.getHttpServer()).post('/api/gamification/admin/events')
      .set('Authorization', 'Bearer ' + token('admin-1', 'ADMIN')).send({ userId: 'member-1', rewardCode: 'welcome', eventKey: 'e1' }).expect(201);
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

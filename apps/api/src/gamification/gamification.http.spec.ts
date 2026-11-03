import { createHash } from 'crypto';
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
import { CapabilityGuard } from '../config/capabilities.guard';

/** HTTP route/role checks; issues real signed JWTs and checks Passport JwtStrategy and RolesGuard. */
describe('gamification HTTP access control', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const previousSecret = process.env.JWT_SECRET;
  const previousIssuers = process.env.SQUARE_REWARD_ISSUERS;
  const issuerSecret = 'learning_test_issuer_secret_123456789012345';
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
    process.env.SQUARE_REWARD_ISSUERS = JSON.stringify([{ id: 'learning', tokenSha256: createHash('sha256').update(issuerSecret).digest('hex'), rewardCodes: ['completed'] }]);
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret })],
      controllers: [GamificationController],
      providers: [
        { provide: GamificationService, useValue: game },
        { provide: PrismaService, useValue: { user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, role: where.id.startsWith('admin') ? 'ADMIN' : 'MEMBER', isActive: true })) } } },
        JwtStrategy, JwtAuthGuard, RolesGuard, CapabilityGuard,
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    jwt = module.get(JwtService);
    app.useGlobalGuards(module.get(CapabilityGuard), module.get(JwtAuthGuard), module.get(RolesGuard));
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (previousIssuers === undefined) delete process.env.SQUARE_REWARD_ISSUERS;
    else process.env.SQUARE_REWARD_ISSUERS = previousIssuers;
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

  it('does not trust a forged admin claim for a member account', async () => {
    await request(app.getHttpServer()).post('/api/gamification/admin/events')
      .set('Authorization', 'Bearer ' + token('member-1', 'ADMIN'))
      .send({ userId: 'member-1', rewardCode: 'welcome', eventKey: 'forged' }).expect(403);
    expect(game.issueReward).not.toHaveBeenCalled();
  });

  it('rejects expired JWTs on protected wallet routes', async () => {
    const expired = jwt.sign(
      { sub: 'member-1', email: 'member-1@example.test', role: 'MEMBER', exp: Math.floor(Date.now() / 1000) - 30 },
    );
    await request(app.getHttpServer()).get('/api/gamification/wallet')
      .set('Authorization', 'Bearer ' + expired).expect(401);
  });

  it('keeps another member out of wallet, inventory, history and purchases', async () => {
    for (const path of ['wallet', 'inventory', 'transactions']) {
      await request(app.getHttpServer()).get('/api/gamification/' + path)
        .set('Authorization', 'Bearer ' + token('member-2', 'MEMBER')).expect(200);
    }
    await request(app.getHttpServer()).post('/api/gamification/purchase')
      .set('Authorization', 'Bearer ' + token('member-2', 'MEMBER'))
      .send({ userId: 'member-1', itemId: 'badge', requestKey: 'member-2-purchase' }).expect(201);
    expect(game.wallet).toHaveBeenCalledWith('member-2');
    expect(game.history).toHaveBeenCalledWith('member-2');
    expect(game.inventory).toHaveBeenCalledWith('member-2');
    expect(game.purchase).toHaveBeenCalledWith('member-2', 'badge', 'member-2-purchase');
  });

  it('allows verified admin JWT identity to issue rewards', async () => {
    await request(app.getHttpServer()).post('/api/gamification/admin/events')
      .set('Authorization', 'Bearer ' + token('admin-1', 'ADMIN')).send({ userId: 'member-1', rewardCode: 'welcome', eventKey: 'e1' }).expect(201);
    expect(game.issueReward).toHaveBeenCalledWith('member-1', 'welcome', 'e1');
  });

  it('authorizes scoped server-to-server issuer events and namespaces idempotency keys', async () => {
    game.issueReward.mockClear();
    await request(app.getHttpServer()).post('/api/gamification/issuer/events')
      .set('Authorization', 'Bearer ' + issuerSecret)
      .send({ userId: 'member-1', rewardCode: 'completed', eventKey: 'attempt-123' }).expect(201);
    expect(game.issueReward).toHaveBeenCalledWith('member-1', 'completed', 'learning:attempt-123');
  });

  it('rejects missing, forged and out-of-scope issuer credentials over HTTP', async () => {
    game.issueReward.mockClear();
    const body = { userId: 'member-1', rewardCode: 'completed', eventKey: 'attempt-456' };
    await request(app.getHttpServer()).post('/api/gamification/issuer/events').send(body).expect(401);
    await request(app.getHttpServer()).post('/api/gamification/issuer/events')
      .set('Authorization', 'Bearer ' + 'x'.repeat(40)).send(body).expect(401);
    await request(app.getHttpServer()).post('/api/gamification/issuer/events')
      .set('Authorization', 'Bearer ' + issuerSecret)
      .send({ ...body, rewardCode: 'admin-bonus' }).expect(401);
    expect(game.issueReward).not.toHaveBeenCalled();
  });

  it('rejects revoked issuer tokens after configuration removal', async () => {
    game.issueReward.mockClear();
    const current = process.env.SQUARE_REWARD_ISSUERS;
    try {
      delete process.env.SQUARE_REWARD_ISSUERS;
      await request(app.getHttpServer()).post('/api/gamification/issuer/events')
        .set('Authorization', 'Bearer ' + issuerSecret)
        .send({ userId: 'member-1', rewardCode: 'completed', eventKey: 'revoked' }).expect(401);
      expect(game.issueReward).not.toHaveBeenCalled();
    } finally {
      process.env.SQUARE_REWARD_ISSUERS = current;
    }
  });

  it('derives the wallet and purchase owner from identity rather than the request body', async () => {
    const wallet = await request(app.getHttpServer()).get('/api/gamification/wallet')
      .set('Authorization', 'Bearer ' + token('member-1', 'MEMBER')).expect(200);
    expect(wallet.body.userId).toBe('member-1');
    await request(app.getHttpServer()).post('/api/gamification/purchase')
      .set('Authorization', 'Bearer ' + token('member-1', 'MEMBER'))
      .send({ userId: 'victim', itemId: 'badge', requestKey: 'p1' }).expect(201);
    expect(game.purchase).toHaveBeenCalledWith('member-1', 'badge', 'p1');
  });
});

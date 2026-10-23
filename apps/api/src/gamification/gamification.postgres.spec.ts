import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GamificationService } from './gamification.service';

// Runs only in the dedicated CI PostgreSQL job. Never use a shared/live database.
const enabled = process.env.GAMIFICATION_INTEGRATION_TEST === '1';
describe.skipIf(!enabled)('gamification PostgreSQL transaction guarantees', () => {
  const prisma = new PrismaClient();
  const game = new GamificationService(prisma as never);
  const token = 'gamification-' + process.pid + '-' + Date.now();
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({ data: { email: token + '@example.test', name: 'Integration test' } });
    userId = user.id;
    const item = await prisma.gameItem.create({ data: { name: token, price: 7 } });
    itemId = item.id;
    await game.defineReward(token, 10);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.gameTransaction.deleteMany({ where: { userId } });
      await prisma.gameRewardEvent.deleteMany({ where: { userId } });
      await prisma.gamePurchase.deleteMany({ where: { userId } });
      await prisma.gameInventory.deleteMany({ where: { userId } });
      await prisma.gameWallet.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    if (itemId) await prisma.gameItem.delete({ where: { id: itemId } });
    await prisma.gameRewardDefinition.deleteMany({ where: { code: token } });
    await prisma.$disconnect();
  });

  it('credits an idempotent reward exactly once even on retries', async () => {
    const first = await game.issueReward(userId, token, token + ':event');
    const retry = await game.issueReward(userId, token, token + ':event');
    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect((await game.wallet(userId)).balance).toBe(10);
    expect(await prisma.gameTransaction.count({ where: { userId, kind: 'REWARD' } })).toBe(1);
  });

  it('cannot debit twice under competing purchases and persists the ledger', async () => {
    const attempts = await Promise.allSettled([
      game.purchase(userId, itemId, token + ':purchase-a'),
      game.purchase(userId, itemId, token + ':purchase-b'),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await game.wallet(userId)).balance).toBe(3);
    expect(await prisma.gameInventory.count({ where: { userId, itemId } })).toBe(1);
    expect(await prisma.gamePurchase.count({ where: { userId, itemId } })).toBe(1);
    expect((await prisma.gameTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }))
      .reduce((sum, row) => sum + row.delta, 0)).toBe(3);
  });

  it('rejects the same purchase request without charging again', async () => {
    const winner = await prisma.gamePurchase.findFirstOrThrow({ where: { userId, itemId } });
    expect((await game.purchase(userId, itemId, winner.requestKey)).duplicate).toBe(true);
    expect((await game.wallet(userId)).balance).toBe(3);
  });
});

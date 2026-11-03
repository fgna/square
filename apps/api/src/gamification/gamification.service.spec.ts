import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { GamificationService } from './gamification.service';

// Transaction mock deliberately reuses shared state to exercise the persisted contract.
function fixture() {
  const events = new Map<string, any>();
  const purchases = new Map<string, any>();
  const owned = new Set<string>();
  const ledger: any[] = [];
  let balance = 0;
  const db: any = {
    gameRewardDefinition: { findUnique: vi.fn(async () => ({ code: 'welcome', amount: 10, active: true })) },
    gameRewardEvent: {
      findUnique: vi.fn(async ({ where }: any) => events.get(where.userId_eventKey.userId + ':' + where.userId_eventKey.eventKey) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const event = { id: 'reward-' + events.size, ...data };
        events.set(data.userId + ':' + data.eventKey, event);
        return event;
      }),
    },
    gameWallet: {
      upsert: vi.fn(async ({ create, update }: any) => { balance += update?.balance?.increment ?? create.balance; }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (balance < where.balance.gte) return { count: 0 };
        balance -= data.balance.decrement; return { count: 1 };
      }),
      findUnique: vi.fn(async () => ({ balance })),
    },
    gameTransaction: {
      create: vi.fn(async ({ data }: any) => { ledger.push(data); return data; }),
      findMany: vi.fn(async () => ledger),
    },
    gameItem: { findUnique: vi.fn(async () => ({ id: 'badge', price: 5, active: true })) },
    gameInventory: {
      findUnique: vi.fn(async ({ where }: any) => owned.has(where.userId_itemId.userId + ':' + where.userId_itemId.itemId) ? {} : null),
      create: vi.fn(async ({ data }: any) => { owned.add(data.userId + ':' + data.itemId); }),
    },
    gamePurchase: {
      findUnique: vi.fn(async ({ where }: any) => purchases.get(where.userId_requestKey.userId + ':' + where.userId_requestKey.requestKey) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const purchase = { id: 'purchase-' + purchases.size, ...data };
        purchases.set(data.userId + ':' + data.requestKey, purchase); return purchase;
      }),
    },
  };
  db.$transaction = async (action: any) => action(db);
  return { service: new GamificationService(db), balance: () => balance, ledger, owned };
}

describe('gamification ledger', () => {
  it('credits once for a retried reward event', async () => {
    const f = fixture();
    expect((await f.service.issueReward('member', 'welcome', 'external:1')).duplicate).toBe(false);
    expect((await f.service.issueReward('member', 'welcome', 'external:1')).duplicate).toBe(true);
    expect(f.balance()).toBe(10);
    expect(f.ledger).toHaveLength(1);
    await expect(f.service.issueReward('member', 'other', 'external:1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects insufficient funds without ownership or ledger changes', async () => {
    const f = fixture();
    await expect(f.service.purchase('member', 'badge', 'p1')).rejects.toBeInstanceOf(BadRequestException);
    expect(f.balance()).toBe(0);
    expect(f.ledger).toHaveLength(0);
    expect(f.owned.size).toBe(0);
  });

  it('charges and grants ownership once', async () => {
    const f = fixture();
    await f.service.issueReward('member', 'welcome', 'external:2');
    expect((await f.service.purchase('member', 'badge', 'p1')).duplicate).toBe(false);
    expect((await f.service.purchase('member', 'badge', 'p1')).duplicate).toBe(true);
    expect(f.balance()).toBe(5);
    expect(f.ledger.map((x) => x.delta)).toEqual([10, -5]);
    expect(f.owned.has('member:badge')).toBe(true);
    await expect(f.service.purchase('member', 'badge', 'p2')).rejects.toBeInstanceOf(ConflictException);
    await expect(f.service.purchase('member', 'different', 'p1')).rejects.toBeInstanceOf(ConflictException);
  });
});

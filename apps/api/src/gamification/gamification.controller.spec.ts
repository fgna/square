import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { GamificationController } from './gamification.controller';

describe('gamification HTTP authorization contract', () => {
  it('restricts reward/event/catalog mutations to administrators', () => {
    for (const method of ['defineReward', 'issueReward', 'defineItem'] as const) {
      expect(Reflect.getMetadata(ROLES_KEY, GamificationController.prototype[method])).toEqual(['ADMIN']);
    }
  });

  it('takes wallet and purchase owner from the authenticated identity', () => {
    const calls: Array<unknown[]> = [];
    const mock = {
      wallet: (...args: unknown[]) => { calls.push(args); return { balance: 0 }; },
      history: (...args: unknown[]) => { calls.push(args); return []; },
      inventory: (...args: unknown[]) => { calls.push(args); return []; },
      purchase: (...args: unknown[]) => { calls.push(args); return { duplicate: false }; },
    };
    const controller = new GamificationController(mock as never);
    controller.wallet('alice');
    controller.history('alice');
    controller.inventory('alice');
    controller.purchase('alice', { itemId: 'badge', requestKey: 'checkout-1' });
    expect(calls).toEqual([
      ['alice'], ['alice'], ['alice'], ['alice', 'badge', 'checkout-1'],
    ]);
  });
});

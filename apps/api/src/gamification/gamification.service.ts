import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  wallet(userId: string) {
    return this.prisma.gameWallet.findUnique({ where: { userId } }).then((wallet) => ({ balance: wallet?.balance ?? 0 }));
  }

  history(userId: string) {
    return this.prisma.gameTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  inventory(userId: string) {
    return this.prisma.gameInventory.findMany({ where: { userId }, include: { item: true }, orderBy: { acquiredAt: 'desc' } });
  }

  equipment(userId: string) {
    return this.prisma.gameEquipment.findMany({ where: { userId } });
  }

  async equip(userId: string, slot: string, itemId: string | null, variant: string) {
    if (!/^[a-z][a-z0-9-]{0,47}$/.test(slot) || !/^[a-z][a-z0-9-]{0,39}$/.test(variant)) {
      throw new BadRequestException('Invalid equipment slot or variant');
    }
    return this.prisma.$transaction(async tx => {
      if (itemId !== null) {
        const owned = await tx.gameInventory.findUnique({ where: { userId_itemId: { userId, itemId } }, include: { item: true } });
        if (!owned || !owned.item.active || !owned.item.cosmetic) throw new BadRequestException('Item not owned or unavailable');
      }
      return tx.gameEquipment.upsert({
        where: { userId_slot: { userId, slot } },
        create: { userId, slot, itemId, variant },
        update: { itemId, variant },
      });
    });
  }

  items() { return this.prisma.gameItem.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }); }

  defineReward(code: string, amount: number) {
    return this.prisma.gameRewardDefinition.upsert({
      where: { code }, create: { code, amount }, update: { amount, active: true },
    });
  }

  defineItem(name: string, price: number, cosmetic: boolean) {
    return this.prisma.gameItem.create({ data: { name, price, cosmetic } });
  }

  async issueReward(userId: string, rewardCode: string, eventKey: string) {
    const existing = await this.prisma.gameRewardEvent.findUnique({ where: { userId_eventKey: { userId, eventKey } } });
    if (existing) {
      if (existing.rewardCode !== rewardCode) throw new ConflictException('Event key already used for another reward');
      return { event: existing, duplicate: true };
    }
    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const reward = await tx.gameRewardDefinition.findUnique({ where: { code: rewardCode } });
        if (!reward?.active) throw new NotFoundException('Reward definition unavailable');
        const event = await tx.gameRewardEvent.create({ data: { userId, rewardCode, eventKey, amount: reward.amount } });
        await tx.gameWallet.upsert({
          where: { userId },
          create: { userId, balance: reward.amount },
          update: { balance: { increment: reward.amount } },
        });
        await tx.gameTransaction.create({ data: { userId, delta: reward.amount, kind: 'REWARD', reference: event.id } });
        return event;
      });
      return { event, duplicate: false };
    } catch (error) {
      if (isUnique(error)) {
        const winner = await this.prisma.gameRewardEvent.findUnique({ where: { userId_eventKey: { userId, eventKey } } });
        if (winner && winner.rewardCode === rewardCode) return { event: winner, duplicate: true };
        throw new ConflictException('Duplicate event key');
      }
      throw error;
    }
  }

  async purchase(userId: string, itemId: string, requestKey: string) {
    const existing = await this.prisma.gamePurchase.findUnique({ where: { userId_requestKey: { userId, requestKey } } });
    if (existing) {
      if (existing.itemId !== itemId) throw new ConflictException('Request key already used for another item');
      return { purchase: existing, duplicate: true };
    }
    try {
      const purchase = await this.prisma.$transaction(async (tx) => {
        const item = await tx.gameItem.findUnique({ where: { id: itemId } });
        if (!item?.active) throw new NotFoundException('Item unavailable');
        const owned = await tx.gameInventory.findUnique({ where: { userId_itemId: { userId, itemId } } });
        if (owned) throw new ConflictException('Item already owned');
        // A conditional atomic update serializes competing debits, preventing overdrafts.
        if (item.price > 0) {
          const debit = await tx.gameWallet.updateMany({
            where: { userId, balance: { gte: item.price } }, data: { balance: { decrement: item.price } },
          });
          if (debit.count !== 1) throw new BadRequestException('Insufficient funds');
        }
        const purchase = await tx.gamePurchase.create({ data: { userId, itemId, requestKey, price: item.price } });
        await tx.gameInventory.create({ data: { userId, itemId } });
        if (item.price > 0) await tx.gameTransaction.create({
          data: { userId, delta: -item.price, kind: 'PURCHASE', reference: purchase.id },
        });
        return purchase;
      });
      return { purchase, duplicate: false };
    } catch (error) {
      if (isUnique(error)) {
        const winner = await this.prisma.gamePurchase.findUnique({ where: { userId_requestKey: { userId, requestKey } } });
        if (winner && winner.itemId === itemId) return { purchase: winner, duplicate: true };
        throw new ConflictException('Purchase already exists or item is owned');
      }
      throw error;
    }
  }
}

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

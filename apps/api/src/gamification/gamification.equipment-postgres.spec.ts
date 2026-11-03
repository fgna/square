import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GamificationService } from './gamification.service';

// Requires an explicitly disposable PostgreSQL connection. Never point at learner data.
const disposable = process.env.TURBO_EQUIPMENT_DISPOSABLE_DB === '1';
const prisma = disposable ? new PrismaClient() : null;
const marker = 'equip-e2e-' + process.pid + '-' + Date.now();
const alice = marker + '-a';
const bob = marker + '-b';
let itemId: string;

describe.skipIf(!disposable)('equipment persistence on disposable PostgreSQL', () => {
  beforeAll(async () => {
    if (!prisma) throw new Error('Disposable Prisma client missing');
    const [first,second,item] = await Promise.all([
      prisma.user.create({data:{id:alice,email:alice+'@example.invalid',name:'Equipment Test A'}}),
      prisma.user.create({data:{id:bob,email:bob+'@example.invalid',name:'Equipment Test B'}}),
      prisma.gameItem.create({data:{name:marker,price:20,cosmetic:true,active:true}}),
    ]);
    itemId=item.id;
    await prisma.gameInventory.create({data:{userId:first.id,itemId}});
  });
  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.gameEquipment.deleteMany({where:{userId:{in:[alice,bob]}}});
      await prisma.gameInventory.deleteMany({where:{userId:{in:[alice,bob]}}});
      await prisma.gameItem.delete({where:{id:itemId}});
      await prisma.user.deleteMany({where:{id:{in:[alice,bob]}}});
    } finally {await prisma.$disconnect();}
  });
  it('persists owned vehicle and color through a new DB read; rejects unowned cross-user selection', async () => {
    if (!prisma) throw new Error('No Prisma client');
    const service = new GamificationService(prisma as any);
    await service.equip(alice,'vehicle',itemId,'blue');
    const saved = await prisma.gameEquipment.findUnique({where:{userId_slot:{userId:alice,slot:'vehicle'}}});
    expect(saved).toMatchObject({userId:alice,itemId,variant:'blue'});
    await expect(service.equip(bob,'vehicle',itemId,'yellow')).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.equipment(bob)).toEqual([]);
    await service.equip(alice,'vehicle',null,'yellow');
    const restored = await prisma.gameEquipment.findUnique({where:{userId_slot:{userId:alice,slot:'vehicle'}}});
    expect(restored).toMatchObject({itemId:null,variant:'yellow'});
  });
});

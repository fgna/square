import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GamificationService } from './gamification.service';

function fixture() {
  const equipment = new Map<string, {userId:string;slot:string;itemId:string|null;variant:string}>();
  const ownership = new Set(['alice:car-1']);
  const db: any = {
    gameInventory: { findUnique: vi.fn(async ({where}:any) => {
      const {userId,itemId} = where.userId_itemId;
      return ownership.has(userId+':'+itemId)
        ? {item:{active:true,cosmetic:true}} : null;
    }) },
    gameEquipment: {
      findMany: vi.fn(async ({where}:any) => [...equipment.values()].filter(x=>x.userId===where.userId)),
      upsert: vi.fn(async ({where,create,update}:any) => {
        const key = where.userId_slot.userId+':'+where.userId_slot.slot;
        const value = {...(equipment.get(key) ?? create),...update};
        equipment.set(key,value);
        return value;
      }),
    },
  };
  db.$transaction = async (fn:any) => fn(db);
  return {game:new GamificationService(db),equipment};
}

describe('authenticated cosmetic equipment', () => {
  it('saves owned cosmetic item and variant and restores per user', async () => {
    const {game} = fixture();
    await game.equip('alice','vehicle','car-1','blue');
    expect(await game.equipment('alice')).toMatchObject([{itemId:'car-1',variant:'blue'}]);
    expect(await game.equipment('bob')).toEqual([]);
    await game.equip('alice','vehicle',null,'yellow');
    expect(await game.equipment('alice')).toMatchObject([{itemId:null,variant:'yellow'}]);
  });
  it('rejects equipping a different member\'s item or bad inputs', async () => {
    const {game} = fixture();
    await expect(game.equip('bob','vehicle','car-1','red')).rejects.toBeInstanceOf(BadRequestException);
    await expect(game.equip('alice','vehicle!','car-1','blue')).rejects.toBeInstanceOf(BadRequestException);
    await expect(game.equipment('bob')).resolves.toEqual([]);
  });
});

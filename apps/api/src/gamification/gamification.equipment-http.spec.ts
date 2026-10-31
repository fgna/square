import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';

// HTTP route contract with synthetic authenticated members and in-memory persistence.
// Production JWT verification is a separate auth integration concern.
describe('equipment HTTP contract', () => {
  let app: INestApplication;
  const selected = new Map<string, any>();
  const db: any = {
    gameEquipment: {
      findMany: vi.fn(async ({where}:any) => [...selected.values()].filter(x => x.userId === where.userId)),
      upsert: vi.fn(async ({where,create,update}:any) => {
        const key = where.userId_slot.userId + ':' + where.userId_slot.slot;
        const value = {...(selected.get(key) ?? create), ...update};
        selected.set(key, value);
        return value;
      }),
    },
    gameInventory: {
      findUnique: vi.fn(async ({where}:any) =>
        where.userId_itemId.userId === 'alice' && where.userId_itemId.itemId === 'car-1'
          ? {item:{active:true,cosmetic:true}} : null),
    },
  };
  db.$transaction = async (fn:any) => fn(db);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers:[GamificationController],
      providers:[
        {provide: GamificationService, useValue: new GamificationService(db)},
        {provide: APP_GUARD, useValue: {canActivate: (ctx:any) => {
          const req = ctx.switchToHttp().getRequest();
          const member = req.headers['x-test-member'];
          if (member !== 'alice' && member !== 'bob') throw new UnauthorizedException();
          req.user = {id:member};
          return true;
        }}},
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.init();
  });
  afterAll(async () => {await app?.close();});

  it('requires authentication, persists after GET and isolates other member', async () => {
    await request(app.getHttpServer()).get('/api/gamification/equipment').expect(401);
    await request(app.getHttpServer()).post('/api/gamification/equipment')
      .set('x-test-member','alice').send({slot:'vehicle',itemId:'car-1',variant:'blue'}).expect(201);
    const saved = await request(app.getHttpServer()).get('/api/gamification/equipment')
      .set('x-test-member','alice').expect(200);
    expect(saved.body).toMatchObject([{slot:'vehicle',itemId:'car-1',variant:'blue'}]);
    const other = await request(app.getHttpServer()).get('/api/gamification/equipment')
      .set('x-test-member','bob').expect(200);
    expect(other.body).toEqual([]);
    await request(app.getHttpServer()).post('/api/gamification/equipment')
      .set('x-test-member','bob').send({slot:'vehicle',itemId:'car-1',variant:'yellow'}).expect(400);
    await request(app.getHttpServer()).post('/api/gamification/equipment')
      .set('x-test-member','alice').send({slot:'vehicle',itemId:null,variant:'yellow'}).expect(201);
    const changed = await request(app.getHttpServer()).get('/api/gamification/equipment')
      .set('x-test-member','alice').expect(200);
    expect(changed.body).toMatchObject([{itemId:null,variant:'yellow'}]);
  });
});

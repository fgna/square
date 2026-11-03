import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, INestApplication, Param, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { ApiPlugin } from '@community/plugin-sdk/api';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { CapabilityGuard } from '../config/capabilities.guard';
import { instanceCapabilities, type Capability } from '../config/capabilities';
import { PrismaService } from '../prisma/prisma.service';
import { PluginsModule } from './plugins.module';

const plugin: ApiPlugin = {
  register({ CurrentUser, data: { groups } }) {
    @Controller('groups')
    class GroupsController {
      @Get()
      list(@CurrentUser('id') member: string) { return groups.list(member); }

      @Get('invites')
      pending(@CurrentUser('id') member: string) { return groups.pendingInvites(member); }

      @Post()
      create(@CurrentUser('id') member: string, @Body('name') name: string) {
        return groups.create(member, { name });
      }

      @Post(':groupId/invite')
      invite(@CurrentUser('id') member: string, @Param('groupId') id: string, @Body('target') target: string) {
        return groups.invite(id, target, member);
      }

      @Post('invites/:id/accept')
      accept(@CurrentUser('id') member: string, @Param('id') id: string) { return groups.accept(id, member); }

      @Post('invites/:id/decline')
      decline(@CurrentUser('id') member: string, @Param('id') id: string) { return groups.decline(id, member); }
    }
    return { controllers: [GroupsController] };
  },
};

describe.skipIf(process.env.PLUGIN_GROUPS_DISPOSABLE_DB !== '1')('plugin group authorization on PostgreSQL', () => {
  const prisma = new PrismaClient();
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const previousSecret = process.env.JWT_SECRET;
  const capabilities = instanceCapabilities as Set<Capability>;
  const previouslyEnabled = capabilities.has('learning-groups');
  const members: Record<string, string> = {};
  let app: INestApplication;
  const path = '/api/p/group-contract/groups';

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    capabilities.add('learning-groups');
    for (const name of ['creator', 'recipient', 'outsider']) {
      const user = await prisma.user.create({
        data: { name, email: randomUUID() + '@example.test', isActive: true },
      });
      members[name] = user.id;
    }
    const module = await Test.createTestingModule({
      imports: [PluginsModule.register([{ id: 'group-contract', plugin }])],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: CapabilityGuard },
      ],
    }).overrideProvider(PrismaService).useValue(prisma).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (!previouslyEnabled) capabilities.delete('learning-groups');
    await app?.close();
    try {
      const ids = Object.values(members);
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('limits invitations and membership to authenticated creators and recipients', async () => {
    const http = request(app.getHttpServer());
    const bearer = (name: string) => 'Bearer ' + jwt.sign({ sub: members[name] });
    await http.get(path).expect(401);
    const created = await http.post(path).set('Authorization', bearer('creator'))
      .send({ name: 'Synthetic group', userId: members.outsider }).expect(201);
    const groupId = created.body.id;
    expect(created.body.createdById).toBe(members.creator);
    await http.get(path).set('Authorization', bearer('outsider')).expect(200, []);

    const invite = (sender: string, target: string) => http.post(path + '/' + groupId + '/invite')
      .set('Authorization', bearer(sender)).send({ target: members[target], userId: members.creator });
    await invite('outsider', 'recipient').expect(403);
    const sent = await invite('creator', 'recipient').expect(201);
    const invitePath = path + '/invites/' + sent.body.inviteId;
    await http.get(path + '/invites').set('Authorization', bearer('outsider')).expect(200, []);
    const pending = await http.get(path + '/invites').set('Authorization', bearer('recipient')).expect(200);
    expect(pending.body.map((row: { id: string }) => row.id)).toEqual([sent.body.inviteId]);
    await http.post(invitePath + '/accept').set('Authorization', bearer('outsider')).expect(404);
    await http.post(invitePath + '/accept').set('Authorization', bearer('recipient')).expect(201);
    expect(await prisma.learningGroupMember.count({ where: { groupId, userId: members.recipient } })).toBe(1);

    const declined = await invite('creator', 'outsider').expect(201);
    await http.post(path + '/invites/' + declined.body.inviteId + '/decline')
      .set('Authorization', bearer('outsider')).expect(201);
    expect(await prisma.learningGroupMember.count({ where: { groupId, userId: members.outsider } })).toBe(0);
    await http.get(path + '/invites').set('Authorization', bearer('outsider')).expect(200, []);

    capabilities.delete('learning-groups');
    try {
      await http.get(path).set('Authorization', bearer('recipient')).expect(404);
      await http.get('/api/learning-groups').set('Authorization', bearer('recipient')).expect(404);
    } finally {
      capabilities.add('learning-groups');
    }
  });
});

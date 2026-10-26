import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LearningGroupsService } from './learning-groups.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

function harness() {
  const invite = { id: 'invite-1', userId: 'recipient', groupId: 'group-1', group: { createdById: 'owner' } };
  const tx = {
    learningGroupInvite: { findUnique: vi.fn().mockResolvedValue(invite), delete: vi.fn() },
    learningGroupMember: { count: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(),
    learningGroup: { findUnique: vi.fn().mockResolvedValue({
      id: 'group-1', createdById: 'owner', members: [{ userId: 'owner' }], invites: [],
    }) },
    user: { findUnique: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    learningGroupInvite: { findUnique: vi.fn().mockResolvedValue(invite), delete: vi.fn() },
  };
  const notify = { create: vi.fn() };
  const service = new LearningGroupsService(
    prisma as unknown as PrismaService, notify as unknown as NotificationsService,
  );
  return { tx, prisma, notify, service };
}

describe('learning group invitation authorization', () => {
  it('rejects invite acceptance by any account other than recipient before a write', async () => {
    const { service, tx } = harness();
    await expect(service.acceptInvite('invite-1', 'stranger')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.learningGroupMember.create).not.toHaveBeenCalled();
    expect(tx.learningGroupInvite.delete).not.toHaveBeenCalled();
  });

  it('rejects invitation creation by a non-creator before a write or notification', async () => {
    const { service, tx, notify } = harness();
    await expect(service.addMember('group-1', 'target', 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.learningGroupInvite.findUnique).not.toHaveBeenCalled();
    expect(notify.create).not.toHaveBeenCalled();
  });

  it('rejects invitation withdrawal by an unrelated account before deletion', async () => {
    const { service, prisma } = harness();
    await expect(service.removeInvite('invite-1', 'stranger')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.learningGroupInvite.delete).not.toHaveBeenCalled();
  });

  it('rejects a missing invite and does not create membership', async () => {
    const { service, tx } = harness();
    tx.learningGroupInvite.findUnique.mockResolvedValueOnce(null);
    await expect(service.acceptInvite('missing', 'recipient')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.learningGroupMember.create).not.toHaveBeenCalled();
  });
});

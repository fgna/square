import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

function harness() {
  const old = { token: 'old', userId: 'u1', expiresAt: new Date(Date.now() + 60_000), replacedBy: null as string | null, rotatedAt: null as Date | null };
  const newer = { token: 'next', userId: 'u1', expiresAt: new Date(Date.now() + 60_000), replacedBy: null, rotatedAt: null };
  const records = new Map<string, any>([['old', old]]);
  const refreshToken = {
    findUnique: vi.fn(async ({ where }: any) => records.get(where.token) ?? null),
    deleteMany: vi.fn(async ({ where }: any) => {
      if (where.token) records.delete(where.token);
      return { count: 1 };
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const row = records.get(where.token);
      if (!row || row.replacedBy !== null) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
    update: vi.fn(async ({ where, data }: any) => {
      Object.assign(records.get(where.token), data);
    }),
    create: vi.fn(async ({ data }: any) => {
      records.set(data.token, { ...data, replacedBy: null, rotatedAt: null });
    }),
  };
  const prisma: any = {
    refreshToken,
    $transaction: (callback: any) => callback({ refreshToken }),
  };
  const jwt: any = { sign: vi.fn().mockReturnValueOnce('access').mockReturnValueOnce('next').mockReturnValue('retried-access') };
  const service = new AuthService(prisma, jwt, {} as any, {} as any);
  return { service, records, old, newer, refreshToken };
}

describe('refresh rotation retry grace (#111)', () => {
  it('returns the same successor after the first response was lost', async () => {
    const { service, records, old } = harness();
    const first = await service.refresh('u1', 'u@example.com', 'MEMBER', 'old', 'fp');
    const retry = await service.refresh('u1', 'u@example.com', 'MEMBER', 'old', 'fp');
    expect(first.refreshToken).toBe('next');
    expect(retry.refreshToken).toBe('next');
    expect(old.replacedBy).toBe('next');
    expect(records.has('next')).toBe(true);
  });

  it('rejects the consumed token after the grace period', async () => {
    const { service, old, records } = harness();
    old.replacedBy = 'next';
    old.rotatedAt = new Date(Date.now() - 21_000);
    records.set('next', { token: 'next', userId: 'u1', expiresAt: new Date(Date.now() + 60_000) });
    await expect(service.refresh('u1', 'u@example.com', 'MEMBER', 'old')).rejects.toThrow(UnauthorizedException);
  });

  it('does not revive a revoked successor', async () => {
    const { service, old } = harness();
    old.replacedBy = 'next';
    old.rotatedAt = new Date();
    await expect(service.refresh('u1', 'u@example.com', 'MEMBER', 'old')).rejects.toThrow(UnauthorizedException);
  });

  it('revokes a rotated successor on logout with the original cookie', async () => {
    const { service, old, records } = harness();
    old.replacedBy = 'next';
    old.rotatedAt = new Date();
    records.set('next', { token: 'next', userId: 'u1', replacedBy: null, expiresAt: new Date(Date.now() + 60_000) });
    await service.logout('old');
    expect(records.size).toBe(0);
  });
});

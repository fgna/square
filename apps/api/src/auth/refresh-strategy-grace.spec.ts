import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { AuthService } from './auth.service';

function setup({ age = 0, fingerprint = true, successor = true } = {}) {
  const req = { cookies: { refresh_token: 'previous' }, headers: { 'user-agent': 'test-client' }, ip: '127.0.0.1' };
  const fhp = AuthService.computeFingerprint(req.headers['user-agent'], req.ip);
  const original = {
    token: 'previous', userId: 'user1', user: { id: 'user1', isActive: true },
    expiresAt: new Date(Date.now() + 60_000), replacedBy: 'current',
    rotatedAt: new Date(Date.now() - age),
  };
  const current = {
    token: 'current', userId: 'user1',
    expiresAt: new Date(Date.now() + 60_000), replacedBy: null,
  };
  const records = new Map<string, any>([['previous', original]]);
  if (successor) records.set('current', current);
  const prisma: any = { refreshToken: {
    findUnique: vi.fn(async ({ where }: any) => records.get(where.token) ?? null),
    deleteMany: vi.fn(async ({ where }: any) => ({ count: Number(records.delete(where.token)) })),
  } };
  const strategy = new JwtRefreshStrategy(prisma);
  return { req, fhp: fingerprint ? fhp : undefined, strategy, prisma, records };
}

describe('refresh guard: bounded same-client retry (#111)', () => {
  it('accepts a recent rotated token from the same fingerprint', async () => {
    const { req, fhp, strategy } = setup();
    await expect(strategy.validate(req, { fhp })).resolves.toMatchObject({ id: 'user1', refreshToken: 'previous' });
  });
  it('rejects a legacy unbound rotated token', async () => {
    const { req, strategy } = setup({ fingerprint: false });
    await expect(strategy.validate(req, {})).rejects.toThrow(UnauthorizedException);
  });
  it('rejects retry after the grace window', async () => {
    const { req, fhp, strategy } = setup({ age: 21_000 });
    await expect(strategy.validate(req, { fhp })).rejects.toThrow(UnauthorizedException);
  });
  it('rejects retry when successor was revoked', async () => {
    const { req, fhp, strategy } = setup({ successor: false });
    await expect(strategy.validate(req, { fhp })).rejects.toThrow(UnauthorizedException);
  });
  it('revokes both previous and successor on fingerprint mismatch', async () => {
    const { req, strategy, records } = setup();
    await expect(strategy.validate(req, { fhp: 'wrong-fingerprint' })).rejects.toThrow(UnauthorizedException);
    expect(records.size).toBe(0);
  });
});

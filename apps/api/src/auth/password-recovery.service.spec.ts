import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordRecoveryService } from './password-recovery.service';

describe('PasswordRecoveryService', () => {
  const cache = new Map<string, string>();
  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const email = { isConfigured: true, send: vi.fn() };
  const redis = {
    set: vi.fn(async (key: string, value: string, _ex: string, _ttl: number, nx?: string) => {
      if (nx === 'NX' && cache.has(key)) return null;
      cache.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => { cache.delete(key); }),
    call: vi.fn(async (_command: string, key: string) => {
      const value = cache.get(key) ?? null;
      cache.delete(key);
      return value;
    }),
  };
  const service = new PasswordRecoveryService(prisma as any, email as any, redis as any);

  beforeEach(() => {
    vi.resetAllMocks();
    cache.clear();
    process.env.PUBLIC_BASE_URL = 'https://example.org';
    email.isConfigured = true;
    email.send.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, passwordHash: 'old' });
    prisma.$transaction.mockResolvedValue([]);
  });

  it('returns the same confirmation for known and unknown emails', async () => {
    const found = await service.request('known@example.org');
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const missing = await service.request('missing@example.org');
    expect(found).toEqual(missing);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('uses a one-time token and invalidates sessions after changing the password', async () => {
    await service.request('known@example.org');
    const html = email.send.mock.calls[0][0].html as string;
    const token = html.match(/token=([a-f0-9]{64})/)?.[1];
    expect(token).toBeTruthy();
    await expect(service.reset(token!, 'A-new-password-123')).resolves.toHaveProperty('message');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    await expect(service.reset(token!, 'A-new-password-123')).rejects.toThrow();
  });

  it('rate limits repeated requests for the same email', async () => {
    await service.request('KNOWN@example.org');
    await service.request('known@example.org');
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('disables recovery without SMTP or a trusted public origin', async () => {
    email.isConfigured = false;
    await service.request('known@example.org');
    email.isConfigured = true;
    process.env.PUBLIC_BASE_URL = 'http://insecure.example.org';
    await service.request('other@example.org');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('removes the token when the email provider fails', async () => {
    email.send.mockResolvedValue(false);
    await service.request('known@example.org');
    expect(redis.del).toHaveBeenCalledOnce();
  });

  it('rejects expired or reused tokens', async () => {
    await expect(service.reset('0'.repeat(64), 'A-new-password-123')).rejects.toThrow();
    await expect(service.reset('invalid', 'A-new-password-123')).rejects.toThrow();
  });
});

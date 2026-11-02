import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { createServer } from 'node:net';
import { performance } from 'node:perf_hooks';
import type Redis from 'ioredis';
import { REDIS_CLIENT, RedisModule } from './redis.module';

// Exercise the actual ioredis provider against a closed synthetic loopback port.
// No live Redis instance, credentials or network destination is involved.
describe('Redis outage handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects offline commands promptly and bounds connected commands', async () => {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const previous = process.env.REDIS_URL;
    process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const module = await Test.createTestingModule({ imports: [RedisModule] }).compile();
    const client = module.get<Redis>(REDIS_CLIENT);
    try {
      const start = performance.now();
      await expect(client.get('synthetic-outage-test')).rejects.toThrow();
      expect(performance.now() - start).toBeLessThan(1000);
      // The same provider also bounds a command on an established stalled socket.
      expect(client.options.commandTimeout).toBe(2000);
      expect(client.options.connectTimeout).toBe(2000);
      expect(client.options.maxRetriesPerRequest).toBe(1);
    } finally {
      client.disconnect();
      await module.close();
      if (previous === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previous;
    }
  });
});

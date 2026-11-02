import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const client = new Redis(
          process.env.REDIS_URL || 'redis://redis:6379',
          {
            // Connect in the background; auth's best-effort rate-limit cache
            // must not queue commands through an outage or stall sign-in.
            lazyConnect: false,
            enableOfflineQueue: false,
            connectTimeout: 2_000,
            commandTimeout: 2_000,
            maxRetriesPerRequest: 1,
          },
        );
        client.on('error', (err: Error) =>
          console.warn(`[RedisModule] ${err.message}`),
        );
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

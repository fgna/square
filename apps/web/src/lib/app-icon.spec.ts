import { describe, it, expect } from 'vitest';
import { readLimited } from './app-icon';

function response(bytes: number, announce?: number) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let sent = 0; sent < bytes; sent += 1024) controller.enqueue(new Uint8Array(Math.min(1024, bytes - sent)));
      controller.close();
    },
  });
  const headers = new Headers(announce !== undefined ? { 'content-length': String(announce) } : {});
  return new Response(body, { headers });
}

describe('readLimited', () => {
  it('reads a body within the limit', async () => {
    expect((await readLimited(response(3000), 5000))?.length).toBe(3000);
  });

  it('refuses a body announced as too large without reading it', async () => {
    expect(await readLimited(response(10, 10_000), 5000)).toBeNull();
  });

  it('stops reading once an unannounced body passes the limit', async () => {
    expect(await readLimited(response(8000), 5000)).toBeNull();
  });
});

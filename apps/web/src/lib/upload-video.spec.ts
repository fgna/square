import { describe, it, expect, vi } from 'vitest';
import { isHostedVideoPath, uploadVideo } from './upload-video';

function fakeApi(chunkSize: number, size: number) {
  let received = 0;
  let failOnce = true;
  const api = {
    post: vi.fn(async (url: string) =>
      url.endsWith('/complete')
        ? { data: { url: '/uploads/videos/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e.mp4', filename: 'a.mp4' } }
        : { data: { id: 'u1', chunkSize, received: 0, size } }),
    put: vi.fn(async (url: string, body: FormData) => {
      const index = Number(url.split('/').pop());
      const chunk = body.get('chunk') as Blob;
      // The second chunk's answer gets lost once, although the server stored it.
      if (index === 1 && failOnce) {
        failOnce = false;
        received = index * chunkSize + chunk.size;
        throw Object.assign(new Error('network'), { response: undefined });
      }
      if (index * chunkSize !== received) {
        throw { response: { status: 409, data: { received } } };
      }
      received += chunk.size;
      return { data: { received } };
    }),
    get: vi.fn(async () => ({ data: { received } })),
    delete: vi.fn(async () => ({})),
  };
  return api;
}

describe('uploadVideo', () => {
  it('uploads in chunks, resumes after a lost answer and returns the video path', async () => {
    vi.useFakeTimers();
    const api = fakeApi(4, 10);
    const progress: number[] = [];
    const file = new File([new Uint8Array(10)], 'a.mp4', { type: 'video/mp4' });

    const done = uploadVideo(api as any, file, (f) => progress.push(f));
    await vi.runAllTimersAsync();

    await expect(done).resolves.toEqual({ url: '/uploads/videos/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e.mp4', filename: 'a.mp4' });
    expect(progress.at(-1)).toBe(1);
    expect(api.delete).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('recognises only paths of uploaded videos', () => {
    expect(isHostedVideoPath('/uploads/videos/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e.mp4')).toBe(true);
    expect(isHostedVideoPath('https://vimeo.com/1')).toBe(false);
    expect(isHostedVideoPath('/uploads/videos/../x.mp4')).toBe(false);
  });
});

describe('uploadVideo with the real API client', () => {
  it('sends each chunk as multipart form data, not as JSON', async () => {
    const { default: axios } = await import('axios');
    const sent: { contentType: string; isForm: boolean; timeout?: number }[] = [];
    // Same defaults as the app's API client (JSON content type, 30 s timeout).
    const api = axios.create({ headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
    api.defaults.adapter = async (config) => {
      if (config.method === 'put') {
        const type = String(config.headers?.['Content-Type'] ?? config.headers?.get?.('Content-Type'));
        sent.push({ contentType: type, isForm: config.data instanceof FormData, timeout: config.timeout });
        return { data: { received: 10 }, status: 200, statusText: 'OK', headers: {}, config };
      }
      const data = config.url!.endsWith('/complete')
        ? { url: '/uploads/videos/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e.mp4', filename: 'a.mov' }
        : { id: 'u1', chunkSize: 16, received: 0, size: 10 };
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    };

    await uploadVideo(api, new File([new Uint8Array(10)], 'a.mov'), () => undefined);

    expect(sent).toHaveLength(1);
    expect(sent[0].isForm).toBe(true);
    expect(sent[0].contentType).toMatch(/multipart\/form-data/);
    expect(sent[0].timeout).toBeGreaterThan(30000);
  });
});

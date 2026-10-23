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

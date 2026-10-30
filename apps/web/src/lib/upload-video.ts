import type { AxiosInstance } from 'axios';

/** Path of a video uploaded to the platform, as stored in a lesson or recording. */
export const HOSTED_VIDEO_PATH = /^\/uploads\/videos\/[0-9a-f-]{36}\.mp4$/;

export function isHostedVideoPath(value: string): boolean {
  return HOSTED_VIDEO_PATH.test(value.trim());
}

interface UploadState {
  id: string;
  chunkSize: number;
  received: number;
  size: number;
}

const RETRIES = 4;
const CHUNK_TIMEOUT_MS = 10 * 60 * 1000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uploads an MP4 to the platform in chunks (admins only) and returns its path
 * (/uploads/videos/<id>.mp4). A failed chunk is retried; after a lost answer
 * or a gap the upload continues from what the server already has.
 */
export async function uploadVideo(
  api: AxiosInstance,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<{ url: string; filename: string }> {
  const started: UploadState = (await api.post('/videos/uploads', { filename: file.name, size: file.size })).data;
  let received = started.received;
  try {
    while (received < file.size) {
      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
      const index = Math.floor(received / started.chunkSize);
      const body = new FormData();
      body.append('chunk', file.slice(index * started.chunkSize, (index + 1) * started.chunkSize), 'chunk');
      let attempt = 0;
      for (;;) {
        try {
          received = (
            await api.put(`/videos/uploads/${started.id}/chunks/${index}`, body, {
              signal,
              // The API client sends JSON by default, which would turn the form into "{}".
              headers: { 'Content-Type': 'multipart/form-data' },
              // 8 MB can take minutes on a slow connection.
              timeout: CHUNK_TIMEOUT_MS,
            })
          ).data.received;
          break;
        } catch (err: any) {
          if (signal?.aborted) throw err;
          const status = err?.response?.status;
          if (status === 409 && typeof err.response.data?.received === 'number') {
            received = err.response.data.received;
            break;
          }
          if ((status && status < 500 && status !== 408 && status !== 429) || ++attempt > RETRIES) throw err;
          await wait(1000 * attempt);
          received = (await api.get(`/videos/uploads/${started.id}`)).data.received;
          if (received > index * started.chunkSize) break;
        }
      }
      onProgress(received / file.size);
    }
    const done = (await api.post(`/videos/uploads/${started.id}/complete`)).data;
    return { url: done.url, filename: done.filename };
  } catch (err) {
    await api.delete(`/videos/uploads/${started.id}`).catch(() => undefined);
    throw err;
  }
}

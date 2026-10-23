import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { VideosService } from './videos.service';
import { VIDEO_CHUNK_BYTES, deleteUnusedHostedVideos, hostedVideoFile, isHostedVideo } from './hosted-video';

/** A fake MP4: "ftyp" at byte 4, then filler. */
function mp4(size: number) {
  const buf = Buffer.alloc(size, 7);
  buf.write('\0\0\0\x18ftypisom', 0, 'latin1');
  return buf;
}

describe('VideosService: chunked MP4 uploads', () => {
  let root: string;
  let service: VideosService;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'videos-'));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.stubEnv('VIDEO_MAX_SIZE_MB', '64');
    service = new VideosService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it('stores a video sent in chunks, resumes after a lost chunk and returns its path', async () => {
    const file = mp4(VIDEO_CHUNK_BYTES * 2 + 1000);
    const { id, chunkSize } = await service.start('admin-1', { filename: 'Session.mp4', size: file.length });
    const chunk = (i: number) => file.subarray(i * chunkSize, (i + 1) * chunkSize);

    await service.appendChunk(id, 0, chunk(0));
    // The answer got lost and the client sends chunk 0 again: accepted, nothing written twice.
    await expect(service.appendChunk(id, 0, chunk(0))).resolves.toEqual({ received: chunkSize });
    // A gap is refused with what the server has, so the client resumes there.
    await expect(service.appendChunk(id, 2, chunk(2))).rejects.toMatchObject({ status: 409 });
    expect((await service.status(id)).received).toBe(chunkSize);

    await service.appendChunk(id, 1, chunk(1));
    await service.appendChunk(id, 2, chunk(2));
    const done = await service.complete(id);

    expect(done).toEqual({ url: `/uploads/videos/${id}.mp4`, filename: 'Session.mp4', size: file.length });
    expect(isHostedVideo(done.url)).toBe(true);
    expect(readFileSync(hostedVideoFile(done.url)!).equals(file)).toBe(true);
    await expect(service.status(id)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses other formats, files that are not MP4 and oversized videos', async () => {
    await expect(service.start('a', { filename: 'talk.mov', size: 100 })).rejects.toMatchObject({ status: 400 });
    await expect(service.start('a', { filename: 'big.mp4', size: 65 * 1024 * 1024 })).rejects.toMatchObject({ status: 400 });

    const { id } = await service.start('a', { filename: 'fake.mp4', size: 100 });
    await expect(service.appendChunk(id, 0, Buffer.alloc(100, 1))).rejects.toMatchObject({ status: 400 });
  });

  it('will not finish an incomplete upload', async () => {
    const file = mp4(VIDEO_CHUNK_BYTES + 10);
    const { id } = await service.start('a', { filename: 'part.mp4', size: file.length });
    await service.appendChunk(id, 0, file.subarray(0, VIDEO_CHUNK_BYTES));
    await expect(service.complete(id)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects upload ids that could reach other files', async () => {
    await expect(service.status('../../etc/passwd')).rejects.toMatchObject({ status: 404 });
  });

  it('removes uploads left unfinished for a day', async () => {
    const { id } = await service.start('a', { filename: 'left.mp4', size: 100 });
    const part = join(root, 'uploads', 'videos', '.partial', `${id}.part`);
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    utimesSync(part, old, old);

    expect(await service.removeStaleUploads()).toBe(1);
    expect(existsSync(part)).toBe(false);
  });
});

describe('deleteUnusedHostedVideos', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'videos-'));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('deletes a video file only when no lesson or recording uses it any more', async () => {
    const service = new VideosService();
    const { id } = await service.start('a', { filename: 'v.mp4', size: 100 });
    await service.appendChunk(id, 0, mp4(100));
    const { url } = await service.complete(id);
    const prisma: any = { lesson: { count: vi.fn().mockResolvedValue(1) }, recording: { count: vi.fn().mockResolvedValue(0) } };
    const logger: any = { warn: vi.fn() };

    await deleteUnusedHostedVideos(prisma, [url, 'https://vimeo.com/1'], logger);
    expect(existsSync(hostedVideoFile(url)!)).toBe(true);

    prisma.lesson.count.mockResolvedValue(0);
    await deleteUnusedHostedVideos(prisma, [url], logger);
    expect(existsSync(hostedVideoFile(url)!)).toBe(false);
  });
});

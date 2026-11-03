import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { VideosService } from './videos.service';
import { VIDEO_CHUNK_BYTES, deleteUnusedHostedVideos, hostedVideoFile, isHostedVideo } from './hosted-video';

/** Top-level box: 4 bytes size, 4 bytes type, payload. */
function box(type: string, payload: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + payload.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, payload]);
}

/**
 * A fake video: "ftyp", then "moov" with a sample description of the given
 * codec, then "mdat" filling up to `size` bytes (moov first or last).
 */
function video(size: number, { brand = 'isom', codec = 'avc1', moovLast = false } = {}) {
  const ftyp = box('ftyp', Buffer.from(`${brand}\0\0\0\0`, 'latin1'));
  const moov = box('moov', box('trak', Buffer.from(`....stsd....${codec}....`, 'latin1')));
  const mdat = box('mdat', Buffer.alloc(size - ftyp.length - moov.length - 8, 7));
  return Buffer.concat(moovLast ? [ftyp, mdat, moov] : [ftyp, moov, mdat]);
}
const mp4 = (size: number) => video(size);

/** Prisma stub: no lesson or recording uses any video unless listed. */
function unused(used: string[] = []) {
  const count = vi.fn(async ({ where }: any) => (used.includes(where.videoUrl ?? where.url) ? 1 : 0));
  return { lesson: { count }, recording: { count }, platformSettings: { count: vi.fn(async ({ where }: any) => (used.includes(where.welcomeVideoUrl) ? 1 : 0)) }, postAttachment: { count } };
}

describe('VideosService: chunked MP4 uploads', () => {
  let root: string;
  let service: VideosService;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'videos-'));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.stubEnv('VIDEO_MAX_SIZE_MB', '64');
    service = new VideosService(unused() as any);
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
    await expect(service.start('a', { filename: 'talk.avi', size: 100 })).rejects.toMatchObject({ status: 400 });
    await expect(service.start('a', { filename: 'big.mp4', size: 65 * 1024 * 1024 })).rejects.toMatchObject({ status: 400 });

    const { id } = await service.start('a', { filename: 'fake.mp4', size: 100 });
    await expect(service.appendChunk(id, 0, Buffer.alloc(100, 1))).rejects.toMatchObject({ status: 400 });
  });

  it('accepts a QuickTime MOV with H.264, also when the index sits at the end', async () => {
    const file = video(5000, { brand: 'qt  ', moovLast: true });
    const { id } = await service.start('a', { filename: 'Aufnahme.mov', size: file.length });
    await service.appendChunk(id, 0, file);
    const done = await service.complete(id);
    expect(done.url).toBe(`/uploads/videos/${id}.mp4`);
    expect(done.filename).toBe('Aufnahme.mov');
  });

  it('refuses HEVC and other codecs that not every browser plays, and removes the upload', async () => {
    for (const codec of ['hvc1', 'apcn']) {
      const file = video(5000, { brand: 'qt  ', codec });
      const { id } = await service.start('a', { filename: 'x.mov', size: file.length });
      await service.appendChunk(id, 0, file);
      await expect(service.complete(id)).rejects.toMatchObject({ status: 400 });
      await expect(service.status(id)).rejects.toMatchObject({ status: 404 });
    }
  });

  it('deletes finished videos nothing uses after a day, keeps used and fresh ones', async () => {
    const upload = async (svc: VideosService) => {
      const { id } = await svc.start('a', { filename: 'v.mp4', size: 3000 });
      await svc.appendChunk(id, 0, mp4(3000));
      return (await svc.complete(id)).url;
    };
    const used = await upload(service);
    const forgotten = await upload(service);
    const fresh = await upload(service);
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    for (const url of [used, forgotten]) utimesSync(hostedVideoFile(url)!, old, old);

    const svc = new VideosService(unused([used]) as any);
    expect(await svc.removeUnusedVideos()).toBe(1);
    expect(existsSync(hostedVideoFile(used)!)).toBe(true);
    expect(existsSync(hostedVideoFile(forgotten)!)).toBe(false);
    expect(existsSync(hostedVideoFile(fresh)!)).toBe(true);
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
    const service = new VideosService(unused() as any);
    const { id } = await service.start('a', { filename: 'v.mp4', size: 100 });
    await service.appendChunk(id, 0, mp4(100));
    const { url } = await service.complete(id);
    const prisma: any = {
      lesson: { count: vi.fn().mockResolvedValue(1) },
      recording: { count: vi.fn().mockResolvedValue(0) },
      platformSettings: { count: vi.fn().mockResolvedValue(0) },
      postAttachment: { count: vi.fn().mockResolvedValue(0) },
    };
    const logger: any = { warn: vi.fn() };

    await deleteUnusedHostedVideos(prisma, [url, 'https://vimeo.com/1'], logger);
    expect(existsSync(hostedVideoFile(url)!)).toBe(true);

    // Still the welcome video: kept.
    prisma.lesson.count.mockResolvedValue(0);
    prisma.platformSettings.count.mockResolvedValue(1);
    await deleteUnusedHostedVideos(prisma, [url], logger);
    expect(existsSync(hostedVideoFile(url)!)).toBe(true);

    prisma.platformSettings.count.mockResolvedValue(0);
    await deleteUnusedHostedVideos(prisma, [url], logger);
    expect(existsSync(hostedVideoFile(url)!)).toBe(false);
  });
});

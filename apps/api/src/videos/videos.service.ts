import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { decodeUploadFilename } from '../uploads/decode-filename';
import { VIDEO_CHUNK_BYTES, hostedVideoPath, videoMaxBytes, videosDir } from './hosted-video';
import { looksLikeMp4OrMov, videoCodec } from './video-codec';

const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STALE_MS = 24 * 60 * 60 * 1000;

interface UploadMeta {
  filename: string;
  size: number;
  userId: string;
  createdAt: string;
}

/**
 * Admin uploads of MP4 videos in chunks, so a video of several gigabytes gets
 * through proxies with small body limits and an interrupted upload continues
 * where it stopped. Chunks are appended in order to uploads/videos/.partial/<id>.part;
 * completing the upload moves the file to uploads/videos/<id>.mp4.
 *
 * MP4 and QuickTime MOV with H.264 video are accepted: every current browser
 * plays them without conversion (a MOV is stored as .mp4, the container is the
 * same family). HEVC/H.265 is refused, because Firefox and many Windows
 * computers cannot play it; other formats are converted before uploading.
 */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  private partialDir() {
    return join(videosDir(), '.partial');
  }

  private files(id: string) {
    if (!UPLOAD_ID.test(id)) throw new NotFoundException('Upload not found');
    const dir = this.partialDir();
    return { meta: join(dir, `${id}.json`), part: join(dir, `${id}.part`) };
  }

  private async readMeta(id: string): Promise<UploadMeta> {
    try {
      return JSON.parse(await readFile(this.files(id).meta, 'utf8'));
    } catch {
      throw new NotFoundException('Upload not found');
    }
  }

  private async received(id: string): Promise<number> {
    return (await stat(this.files(id).part)).size;
  }

  async start(userId: string, dto: { filename: string; size: number }) {
    const filename = decodeUploadFilename(String(dto.filename ?? '')).trim();
    const size = Number(dto.size);
    if (!/\.(mp4|m4v|mov)$/i.test(filename)) {
      throw new BadRequestException('Only MP4 or MOV videos (H.264) can be uploaded');
    }
    if (!Number.isInteger(size) || size <= 0) throw new BadRequestException('Invalid file size');
    const max = videoMaxBytes();
    if (size > max) {
      throw new BadRequestException(`Video too large. Maximum ${Math.round(max / 1024 / 1024)} MB`);
    }
    const id = randomUUID();
    const { meta, part } = this.files(id);
    await mkdir(this.partialDir(), { recursive: true });
    const data: UploadMeta = { filename, size, userId, createdAt: new Date().toISOString() };
    await writeFile(meta, JSON.stringify(data));
    await writeFile(part, Buffer.alloc(0));
    return { id, chunkSize: VIDEO_CHUNK_BYTES, received: 0, size };
  }

  async status(id: string) {
    const meta = await this.readMeta(id);
    return { id, chunkSize: VIDEO_CHUNK_BYTES, received: await this.received(id), size: meta.size };
  }

  /**
   * Appends chunk number `index`. A chunk that was already stored (the
   * client retries after a lost answer) is accepted without writing again;
   * a gap answers 409 with what the server has, so the client resumes there.
   */
  async appendChunk(id: string, index: number, chunk: Buffer | undefined) {
    const meta = await this.readMeta(id);
    if (!chunk || chunk.length === 0) throw new BadRequestException('Empty chunk');
    if (!Number.isInteger(index) || index < 0) throw new BadRequestException('Invalid chunk number');
    const offset = index * VIDEO_CHUNK_BYTES;
    const end = offset + chunk.length;
    const isLast = end === meta.size;
    if (chunk.length > VIDEO_CHUNK_BYTES || end > meta.size || (!isLast && chunk.length !== VIDEO_CHUNK_BYTES)) {
      throw new BadRequestException('Chunk does not fit the announced file');
    }
    const received = await this.received(id);
    if (end <= received) return { received };
    if (offset !== received) {
      throw new ConflictException({ message: 'Chunk out of order', received });
    }
    // An MP4/MOV file starts with a box: 4 bytes size, then its type ("ftyp" for MP4).
    if (index === 0 && !looksLikeMp4OrMov(chunk)) {
      throw new BadRequestException('This is not an MP4 or MOV video');
    }
    const handle = await open(this.files(id).part, 'a');
    try {
      await handle.write(chunk);
    } finally {
      await handle.close();
    }
    return { received: end };
  }

  async complete(id: string) {
    const meta = await this.readMeta(id);
    const received = await this.received(id);
    if (received !== meta.size) {
      throw new ConflictException({ message: 'Upload incomplete', received });
    }
    const { meta: metaFile, part } = this.files(id);
    const codec = await videoCodec(part);
    if (codec === 'hevc') {
      await this.abort(id);
      throw new BadRequestException(
        'HEVC (H.265) videos do not play in every browser. Export with H.264, e.g. in QuickTime: "Greater compatibility (H.264)".',
      );
    }
    if (codec !== 'h264') {
      // ProRes, MPEG-4 Part 2 and other codecs from cameras or editing software.
      await this.abort(id);
      throw new BadRequestException('The video must be H.264 (MP4 or MOV). Convert it first, e.g. QuickTime "Export As".');
    }
    await rename(part, join(videosDir(), `${id}.mp4`));
    await rm(metaFile, { force: true });
    return { url: hostedVideoPath(id), filename: meta.filename, size: meta.size };
  }

  async abort(id: string) {
    const { meta, part } = this.files(id);
    await rm(meta, { force: true });
    await rm(part, { force: true });
    return { message: 'Upload cancelled' };
  }

  /** Removes uploads that were started but not finished within a day. */
  @Cron(CronExpression.EVERY_HOUR)
  async removeStaleUploads(now = Date.now()) {
    let names: string[];
    try {
      names = await readdir(this.partialDir());
    } catch {
      return 0;
    }
    let removed = 0;
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      const id = name.slice(0, -'.json'.length);
      if (!UPLOAD_ID.test(id)) continue;
      const { meta, part } = this.files(id);
      // The part file changes with every chunk; an upload in progress stays.
      const info = (await stat(part).catch(() => null)) ?? (await stat(meta).catch(() => null));
      if (info && now - info.mtimeMs > STALE_MS) {
        await rm(meta, { force: true });
        await rm(part, { force: true });
        removed++;
      }
    }
    if (removed) this.logger.log(`Removed ${removed} unfinished video uploads`);
    return removed;
  }
}

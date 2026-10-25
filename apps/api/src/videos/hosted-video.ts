import { Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { resolve, sep } from 'path';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Videos uploaded to the platform itself (instead of YouTube, Vimeo or Loom).
 * A finished upload is stored as uploads/videos/<id>.mp4 and referenced by its
 * path, /uploads/videos/<id>.mp4, in the same field that otherwise holds an
 * external link (Lesson.videoUrl, Recording.url). The file is only served with
 * a signed, expiring link (see uploads/attachment-links.ts).
 */
const HOSTED_VIDEO = /^\/uploads\/videos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.mp4$/;

export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;

export function isHostedVideo(url: string | null | undefined): url is string {
  return typeof url === 'string' && HOSTED_VIDEO.test(url);
}

export function hostedVideoPath(id: string): string {
  return `/uploads/videos/${id}.mp4`;
}

/** Folder for finished videos, below the API's uploads folder. */
export function videosDir(): string {
  return resolve(process.cwd(), 'uploads', 'videos');
}

/** Absolute file of a hosted video path; null for anything else. */
export function hostedVideoFile(url: string): string | null {
  const match = HOSTED_VIDEO.exec(url);
  if (!match) return null;
  const dir = videosDir();
  const file = resolve(dir, `${match[1]}.mp4`);
  return file.startsWith(dir + sep) ? file : null;
}

export function hostedVideoExists(url: string): boolean {
  const file = hostedVideoFile(url);
  return !!file && existsSync(file);
}

/** Largest accepted video in bytes, from VIDEO_MAX_SIZE_MB (default 4096). */
export function videoMaxBytes(): number {
  const mb = Number(process.env.VIDEO_MAX_SIZE_MB);
  return (Number.isInteger(mb) && mb > 0 ? mb : 4096) * 1024 * 1024;
}

/**
 * Deletes hosted video files that no lesson, no recording and not the
 * welcome video points to any more. Called after a video was replaced or its
 * lesson/recording deleted, and by the daily clean-up.
 */
export async function deleteUnusedHostedVideos(prisma: PrismaService, urls: (string | null | undefined)[], logger: Logger) {
  let deleted = 0;
  for (const url of new Set(urls.filter(isHostedVideo))) {
    const [lessons, recordings, welcome] = await Promise.all([
      prisma.lesson.count({ where: { videoUrl: url } }),
      prisma.recording.count({ where: { url } }),
      prisma.platformSettings.count({ where: { welcomeVideoUrl: url } }),
    ]);
    if (lessons > 0 || recordings > 0 || welcome > 0) continue;
    const file = hostedVideoFile(url);
    if (!file) continue;
    await unlink(file).then(
      () => deleted++,
      (err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') logger.warn(`Could not delete ${url}: ${err.message}`);
      },
    );
  }
  return deleted;
}

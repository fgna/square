import type { Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { resolve, sep } from 'path';

/** Deletes stored upload files (/uploads/…) from disk; missing files are ignored. */
export async function removeUploadedFiles(paths: string[], logger: Logger) {
  const root = resolve(process.cwd(), 'uploads');
  for (const p of paths) {
    if (!p.startsWith('/uploads/')) continue;
    const file = resolve(root, p.slice('/uploads/'.length));
    if (!file.startsWith(root + sep)) continue;
    await unlink(file).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') logger.warn(`Could not delete ${p}: ${err.message}`);
    });
  }
}

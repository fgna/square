import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { CommunityContentManifest, validateCommunityContentManifest } from './content-manifest';

export interface InspectedContentPack {
  manifest: CommunityContentManifest;
  files: ReadonlyArray<{ path: string; sha256: string; bytes: number }>;
}

const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_CONTENT_BYTES = 1024 * 1024;

function within(root: string, file: string): string {
  const full = resolve(root, file);
  const rel = relative(root, full);
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel) || rel === '') {
    throw new Error('content pack path escapes root');
  }
  return full;
}

async function readBounded(root: string, file: string, maxBytes: number): Promise<Buffer> {
  // Both the resolved parent chain and the opened final descriptor must stay
  // in the trusted root. Reject symlink ancestors, final symlinks and
  // non-regular files. Never accept a request-provided root.
  const canonicalRoot = await realpath(root);
  if (canonicalRoot !== root) throw new Error('noncanonical pack root prohibited');
  const canonical = await realpath(file);
  if (canonical !== file) throw new Error('pack file or ancestor symlink prohibited');
  const rel = relative(root, canonical);
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) {
    throw new Error('content pack path escapes root');
  }
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('content pack file exceeds size limit or is not regular');
    const content = await handle.readFile();
    if (content.length > maxBytes) throw new Error('content pack file exceeds size limit');
    return content;
  } finally {
    await handle.close();
  }
}

/**
 * Read-only inspection. This function does not import, activate, or persist content.
 * The caller must supply a trusted local root, not a request-supplied path.
 */
export async function inspectCommunityContentPack(rootDirectory: string): Promise<InspectedContentPack> {
  const root = resolve(rootDirectory);
  const manifestData = await readBounded(root, within(root, 'community.json'), MAX_MANIFEST_BYTES);
  const manifest = validateCommunityContentManifest(JSON.parse(manifestData.toString('utf8')));

  const paths = [manifest.assessment?.definition, manifest.journal?.definition, manifest.journal?.translations?.de, manifest.journal?.translations?.en, manifest.branding].filter(
    (value): value is string => value !== undefined,
  );
  const files = await Promise.all(paths.map(async (path) => {
    const content = await readBounded(root, within(root, path), MAX_CONTENT_BYTES);
    JSON.parse(content.toString('utf8'));
    return { path, sha256: createHash('sha256').update(content).digest('hex'), bytes: content.length };
  }));
  return { manifest, files };
}

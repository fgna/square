import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { applyMethodTranslations, requireCompleteMethodTranslations } from './method-message-layers';
import { verifyBilingualAssessmentMethod } from './assessment-method-parity';

const MAX_TRANSLATION_BYTES = 256 * 1024;
const SUPPORTED = ['de', 'en'] as const;
export type MethodLocale = typeof SUPPORTED[number];

function safeRelativePath(root: string, candidate: string): string {
  const full = resolve(root, candidate);
  const rel = relative(root, full);
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) {
    throw new Error('Private translation path escapes content directory');
  }
  return full;
}

/**
 * Server-side preparation only; integrated by the trusted instance message loader.
 * Read from a trusted deployment-controlled content root, never a user-provided path.
 * A realpath check excludes symlinks inside the content root, and O_NOFOLLOW
 * protects the final file against a swapped symlink at open time.
 */
export async function readPrivateMethodMessages(rootDirectory: string, locale: MethodLocale): Promise<unknown> {
  return readPackMessages(rootDirectory, locale, 'method.json');
}

/**
 * Instance texts (i18n/<locale>/overrides.json), read like the method texts.
 * Optional: null when the pack has none. Checked by instance-text-rules.mjs.
 */
export async function readInstanceTextOverrides(rootDirectory: string, locale: MethodLocale): Promise<unknown | null> {
  try {
    return await readPackMessages(rootDirectory, locale, 'overrides.json');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function readPackMessages(rootDirectory: string, locale: MethodLocale, name: string): Promise<unknown> {
  if (!SUPPORTED.includes(locale)) throw new Error('Unsupported method locale');
  const root = await realpath(resolve(rootDirectory));
  const file = safeRelativePath(root, join('i18n', locale, name));
  const actual = await realpath(file);
  if (actual !== file) throw new Error('Private translation symlink prohibited');
  const { constants } = await import('node:fs');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_TRANSLATION_BYTES) throw new Error('Invalid private translation file');
    // Read from the already opened descriptor, not by pathname (TOCTOU).
    const bytes = await handle.readFile();
    if (bytes.length > MAX_TRANSLATION_BYTES) throw new Error('Private translation too large');
    return JSON.parse(bytes.toString('utf8')) as unknown;
  } finally {
    await handle.close();
  }
}

/** Require both locales to validate before returning either. No partial installation. */
export async function prepareBilingualMethodMessages(
  rootDirectory: string,
  genericBase: Record<MethodLocale, Record<string, unknown>>,
  activeInstrument?: { dimensions: string[] },
): Promise<Record<MethodLocale, Record<string, unknown>>> {
  const [de, en] = await Promise.all([
    readPrivateMethodMessages(rootDirectory, 'de'),
    readPrivateMethodMessages(rootDirectory, 'en'),
  ]);
  const catalogs = {
    de: applyMethodTranslations(genericBase.de, de),
    en: applyMethodTranslations(genericBase.en, en),
  };
  if (activeInstrument) verifyBilingualAssessmentMethod(activeInstrument, catalogs);
  return catalogs;
}

/**
 * Strict preparation gate for private instance activation. Unlike the
 * development overlay, this refuses to inherit method-owned assessment or
 * journal labels from the legacy application catalogs.
 *
 * Do not connect this to request.ts until the generic base catalogs have
 * themselves passed content/IP review and been scrubbed.
 */
export async function prepareCompleteBilingualMethodMessages(
  rootDirectory: string,
  genericBase: Record<MethodLocale, Record<string, unknown>>,
  activeInstrument: { dimensions: string[] },
): Promise<Record<MethodLocale, Record<string, unknown>>> {
  const [de, en] = await Promise.all([
    readPrivateMethodMessages(rootDirectory, 'de'),
    readPrivateMethodMessages(rootDirectory, 'en'),
  ]);
  requireCompleteMethodTranslations(de);
  requireCompleteMethodTranslations(en);
  const catalogs = {
    de: applyMethodTranslations(genericBase.de, de),
    en: applyMethodTranslations(genericBase.en, en),
  };
  verifyBilingualAssessmentMethod(activeInstrument, catalogs);
  return catalogs;
}

/**
 * Read the active dimension IDs from the versioned content pack, not from a
 * separately maintained environment variable. Only trusted deployment paths
 * and regular files under the canonical pack root are accepted.
 */
export async function readActiveAssessmentIdentity(rootDirectory: string): Promise<{instrumentId: string; instrumentVersion: string; dimensions: string[]}> {
  const root = await realpath(resolve(rootDirectory));
  const { constants } = await import('node:fs');
  async function readJson(candidate: string): Promise<unknown> {
    const full = safeRelativePath(root, candidate);
    if (await realpath(full) !== full) throw new Error('Assessment content symlink prohibited');
    const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_TRANSLATION_BYTES) {
        throw new Error('Invalid assessment content file');
      }
      return JSON.parse((await handle.readFile()).toString('utf8')) as unknown;
    } finally {
      await handle.close();
    }
  }
  const manifest = await readJson('community.json');
  if (!manifest || typeof manifest !== 'object' || !('assessment' in manifest)) {
    throw new Error('Assessment manifest missing');
  }
  const assessment = (manifest as { assessment?: unknown }).assessment;
  if (!assessment || typeof assessment !== 'object') throw new Error('Assessment manifest invalid');
  const entry = assessment as { definition?: unknown; instrumentId?: unknown; instrumentVersion?: unknown };
  if (typeof entry.definition !== 'string') throw new Error('Assessment definition path missing');
  const definition = await readJson(entry.definition);
  if (!definition || typeof definition !== 'object') throw new Error('Assessment definition invalid');
  const value = definition as { dimensions?: unknown; instrumentId?: unknown; instrumentVersion?: unknown };
  if (value.instrumentId !== entry.instrumentId || value.instrumentVersion !== entry.instrumentVersion) {
    throw new Error('Assessment instrument identity mismatch');
  }
  const dimensions = value.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length < 1 || dimensions.length > 20 ||
      dimensions.some(key => typeof key !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(key)) ||
      new Set(dimensions).size !== dimensions.length) {
    throw new Error('Invalid instrument dimensions');
  }
  if (typeof entry.instrumentId !== 'string' || typeof entry.instrumentVersion !== 'string') {
    throw new Error('Assessment instrument identity missing');
  }
  return {instrumentId: entry.instrumentId, instrumentVersion: entry.instrumentVersion, dimensions: dimensions as string[]};
}

/** Backward-compatible accessor for bilingual translation checks. */
export async function readActiveAssessmentDimensions(rootDirectory: string): Promise<string[]> {
  return (await readActiveAssessmentIdentity(rootDirectory)).dimensions;
}

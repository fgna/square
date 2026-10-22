/** Declarative, neutral community content manifest. */
export interface CommunityContentManifest {
  schemaVersion: 1;
  id: string;
  version: string;
  platformCompatibility: string;
  locales: string[];
  assessment?: {
    instrumentId: string;
    instrumentVersion: string;
    definition: string;
  };
  journal?: { definition: string; translations?: { de: string; en: string } };
  branding?: string;
}

const ID = /^[a-z][a-z0-9-]{1,63}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireKeys(record: Record<string, unknown>, allowed: string[], path: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) throw new Error(`${path}: unknown property ${key}`);
  }
}

function requiredString(value: unknown, path: string, regex?: RegExp): string {
  if (typeof value !== 'string' || !value.trim() || (regex && !regex.test(value))) {
    throw new Error(`${path}: invalid string`);
  }
  return value;
}

function relativeContentPath(value: unknown, path: string): string {
  const name = requiredString(value, path);
  if (name.startsWith('/') || name.includes('\\') || name.split('/').some((s) => s === '..' || s === '.' || !s) || name.includes(':')) {
    throw new Error(`${path}: unsafe relative path`);
  }
  return name;
}

/** Parse an untrusted JSON-decoded manifest; reject unknown fields and unsafe paths. */
export function validateCommunityContentManifest(input: unknown): CommunityContentManifest {
  if (!object(input)) throw new Error('manifest: expected object');
  requireKeys(input, ['schemaVersion', 'id', 'version', 'platformCompatibility', 'locales', 'assessment', 'journal', 'branding'], 'manifest');
  if (input.schemaVersion !== 1) throw new Error('manifest: unsupported schemaVersion');

  const id = requiredString(input.id, 'manifest.id', ID);
  const version = requiredString(input.version, 'manifest.version', VERSION);
  const platformCompatibility = requiredString(input.platformCompatibility, 'manifest.platformCompatibility');
  if (platformCompatibility.length > 100) throw new Error('manifest.platformCompatibility: too long');
  if (!Array.isArray(input.locales) || input.locales.length === 0 || input.locales.length > 20 ||
      input.locales.some((v) => typeof v !== 'string' || !LOCALE.test(v)) ||
      new Set(input.locales).size !== input.locales.length) {
    throw new Error('manifest.locales: invalid locales');
  }

  const result: CommunityContentManifest = {
    schemaVersion: 1, id, version, platformCompatibility, locales: [...input.locales],
  };
  if (input.assessment !== undefined) {
    if (!object(input.assessment)) throw new Error('manifest.assessment: expected object');
    requireKeys(input.assessment, ['instrumentId', 'instrumentVersion', 'definition'], 'manifest.assessment');
    result.assessment = {
      instrumentId: requiredString(input.assessment.instrumentId, 'manifest.assessment.instrumentId', ID),
      instrumentVersion: requiredString(input.assessment.instrumentVersion, 'manifest.assessment.instrumentVersion'),
      definition: relativeContentPath(input.assessment.definition, 'manifest.assessment.definition'),
    };
  }
  if (input.journal !== undefined) {
    if (!object(input.journal)) throw new Error('manifest.journal: expected object');
    requireKeys(input.journal, ['definition', 'translations'], 'manifest.journal');
    result.journal = { definition: relativeContentPath(input.journal.definition, 'manifest.journal.definition') };
    if (input.journal.translations !== undefined) {
      if (!object(input.journal.translations)) throw new Error('manifest.journal.translations: expected object');
      requireKeys(input.journal.translations, ['de', 'en'], 'manifest.journal.translations');
      result.journal.translations = {
        de: relativeContentPath(input.journal.translations.de, 'manifest.journal.translations.de'),
        en: relativeContentPath(input.journal.translations.en, 'manifest.journal.translations.en'),
      };
    }
  }
  if (input.branding !== undefined) result.branding = relativeContentPath(input.branding, 'manifest.branding');
  return result;
}

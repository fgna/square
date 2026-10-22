import { icuArguments } from './instance-text-rules.mjs';

/**
 * Content translation overlay contract (#191). No private wording belongs here.
 * Only the method-owned keys below; an instance's own wording for other Core
 * texts goes through instance-text-rules.mjs (overrides.json, with guard rails).
 */
export const METHOD_TRANSLATION_KEYS = {
  assessment: ['instructions', 'scaleTitle', 'scale', 'dimensions', 'dimensionsShort', 'bands', 'suggestions', 'introText', 'pathText'],
  journal: ['goalsLabel', 'goalPlaceholder', 'tasksLabel', 'taskPlaceholder', 'whoLabel', 'whoPlaceholder', 'forwardLabel', 'forwardPlaceholder', 'peopleLabel', 'peoplePlaceholder', 'thoughtsLabel', 'thoughtsPlaceholder'],
  leadershipAIUI: [], // Further review required before any AI-specific localization is moved.
} as const;

type Messages = Record<string, unknown>;
const BAND_KEYS = ['strength', 'solid', 'develop'] as const;
const SCALE_KEYS = ['1', '2', '3', '4', '5', 'na'] as const;
function validateBands(input: unknown): void {
  if (typeof input === 'string') {
    if (!input.trim() || input.length > 8000) throw new Error('assessment.bands: invalid string');
    return;
  }
  if (!object(input) || Object.keys(input).length !== BAND_KEYS.length ||
      BAND_KEYS.some(key => !Object.prototype.hasOwnProperty.call(input, key)) ||
      BAND_KEYS.some(key => typeof input[key] !== 'string' || !(input[key] as string).trim() || (input[key] as string).length > 8000)) {
    throw new Error('assessment.bands: invalid band labels');
  }
}
function validateScale(input: unknown): void {
  if (typeof input === 'string') {
    if (!input.trim() || input.length > 8000) throw new Error('assessment.scale: invalid string');
    return;
  }
  if (!object(input) || Object.keys(input).length !== SCALE_KEYS.length ||
      SCALE_KEYS.some(key => !Object.prototype.hasOwnProperty.call(input, key))) {
    throw new Error('assessment.scale: invalid rating labels');
  }
  for (const key of SCALE_KEYS) {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 8000) {
      throw new Error('assessment.scale: invalid rating label');
    }
  }
}

const INSTRUMENT_MAP_KEYS = new Set(['dimensions', 'dimensionsShort', 'suggestions']);
const INSTRUMENT_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function validateInstrumentMap(input: unknown, prefix: string): void {
  if (!object(input)) throw new Error(prefix + ': expected map');
  const keys = Object.keys(input);
  if (!keys.length || keys.length > 100) throw new Error(prefix + ': invalid number of keys');
  if (prefix.endsWith('.suggestions') && (!keys.includes('strength') || !keys.includes('solid'))) {
    throw new Error(prefix + ': missing common suggestion bands');
  }
  for (const key of keys) {
    if (!INSTRUMENT_KEY.test(key)) throw new Error(prefix + ': invalid instrument key');
    const value = input[key];
    if (typeof value === 'string') {
      if (!value.trim() || value.length > 8000) throw new Error(prefix + ': invalid string');
    } else throw new Error(prefix + ': invalid entry');
  }
}

function object(v: unknown): v is Messages {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function validateTree(input: unknown, reference: unknown, prefix: string): void {
  if (typeof reference === 'string') {
    if (typeof input !== 'string' || !input.trim() || input.length > 8000) throw new Error(prefix + ': invalid translation');
    // Only placeholders the UI provides; using fewer of them is fine.
    let used: Set<string>;
    try {
      used = icuArguments(input);
    } catch {
      throw new Error(prefix + ': invalid message syntax');
    }
    const offered = icuArguments(reference);
    if ([...used].some(name => !offered.has(name))) throw new Error(prefix + ': interpolation keys differ');
    return;
  }
  if (!object(reference) || !object(input)) throw new Error(prefix + ': mismatched translation type');
  const expected = Object.keys(reference);
  if (Object.keys(input).length !== expected.length ||
      expected.some(key => !(key in input))) throw new Error(prefix + ': expected identical translation keys');
  for (const key of expected) validateTree(input[key], reference[key], prefix + '.' + key);
}

/**
 * Strict, all-or-nothing method content replacement. Generic UI remains platform-owned.
 * No merging into the shared base and no mutation; missing protected sections must fail.
 */
export function applyMethodTranslations(base: Messages, method: unknown): Messages {
  if (!object(method)) throw new Error('method translations must be an object');
  const allowed = Object.entries(METHOD_TRANSLATION_KEYS)
    .filter(([, keys]) => keys.length > 0)
    .map(([namespace]) => namespace);
  if (Object.keys(method).some(namespace => !allowed.includes(namespace))) {
    throw new Error('method translations cannot override platform namespaces');
  }
  const output: Messages = { ...base };
  for (const [namespace, section] of Object.entries(method)) {
    const keys = METHOD_TRANSLATION_KEYS[namespace as keyof typeof METHOD_TRANSLATION_KEYS] as readonly string[];
    if (!object(section) || Object.keys(section).some(key => !keys.includes(key) && !(namespace === 'journal' && key === 'moods'))) {
      throw new Error(namespace + ': invalid protected key');
    }
    const original = base[namespace];
    if (!object(original)) throw new Error(namespace + ': unknown base namespace');
    const replacement: Messages = { ...original };
    for (const [key, value] of Object.entries(section)) {
      if (namespace === 'journal' && key === 'moods') continue;
      if (!(key in original)) throw new Error(namespace + '.' + key + ': missing base key');
      if (namespace === 'assessment' && key === 'bands') {
        validateBands(value);
      } else if (namespace === 'assessment' && key === 'scale') {
        validateScale(value);
      } else if (namespace === 'assessment' && INSTRUMENT_MAP_KEYS.has(key)) {
        validateInstrumentMap(value, namespace + '.' + key);
      } else {
        validateTree(value, original[key], namespace + '.' + key);
      }
      replacement[key] = value;
    }
    output[namespace] = replacement;
  }
  return output;
}

/**
 * Pre-activation gate: a method-owned section must be fully provided by the
 * external catalog. Partial overlays are useful for developing a pack, but
 * must never be used to activate a clean generic installation: doing so could
 * silently display remaining proprietary strings from bundled legacy catalogs.
 *
 * This only proves declared-key coverage. It does NOT prove the bundled base
 * catalog has been scrubbed or establish rights to distribute it.
 */
export function requireCompleteMethodTranslations(
  method: unknown,
  requiredNamespaces: readonly ('assessment' | 'journal')[] = ['assessment', 'journal'],
): void {
  if (!object(method)) throw new Error('method translations must be an object');
  for (const namespace of requiredNamespaces) {
    const section = method[namespace];
    if (!object(section)) throw new Error(namespace + ': required private method section missing');
    const allowed = METHOD_TRANSLATION_KEYS[namespace] as readonly string[];
    const supplied = Object.keys(section).filter(key => !(namespace === 'journal' && key === 'moods'));
    if (supplied.length !== allowed.length ||
        allowed.some(key => !Object.prototype.hasOwnProperty.call(section, key))) {
      throw new Error(namespace + ': incomplete private method translation coverage');
    }
  }
}

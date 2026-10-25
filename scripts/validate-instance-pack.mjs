#!/usr/bin/env node
// Read-only compatibility preflight for independently checked-out instance packs.
// Reports errors without printing customer content, credentials or file bytes.
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenMessages, overrideProblems } from '../apps/web/src/i18n/instance-text-rules.mjs';

const METHOD_KEYS = {
  assessment: ['instructions', 'scaleTitle', 'scale', 'dimensions', 'dimensionsShort', 'bands', 'suggestions', 'introText', 'pathText'],
  journal: ['goalsLabel', 'goalPlaceholder', 'tasksLabel', 'taskPlaceholder', 'whoLabel', 'whoPlaceholder', 'forwardLabel', 'forwardPlaceholder', 'peopleLabel', 'peoplePlaceholder', 'thoughtsLabel', 'thoughtsPlaceholder'],
};
const errors = [];
const fail = (code) => errors.push(code);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
// Accept legacy summary text or one localized label for every supported rating.
const validAssessmentBands = value => text(value) ||
  (keysEqual(value, ['strength', 'solid', 'develop']) && Object.values(value).every(v => text(v) && v.length <= 8000));
const validAssessmentScale = value => text(value) ||
  (keysEqual(value, ['1', '2', '3', '4', '5', 'na']) && Object.values(value).every(text));
const keysEqual = (value, list) => object(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...list].sort());

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  console.error('Usage: bash scripts/dev-instance-pack-check.sh /absolute/path/to/private-repo/content');
  process.exit(2);
}
let root;
try {
  if (!isAbsolute(input)) throw Error();
  root = realpathSync(input);
  if (root !== resolve(input) || !lstatSync(root).isDirectory()) throw Error();
} catch {
  console.error('FAIL: PACK_ROOT_INVALID (must be an existing canonical absolute directory)');
  process.exit(1);
}
function readJson(path, code) {
  if (!text(path) || isAbsolute(path) || path.includes('\\') || path.split('/').some(p => p === '..' || p === '.')) {
    fail(code + '_PATH_INVALID'); return;
  }
  const full = resolve(root, path);
  const rel = relative(root, full);
  if (!rel || rel.startsWith('..' + sep) || rel === '..' || isAbsolute(rel)) {
    fail(code + '_PATH_ESCAPE'); return;
  }
  try {
    const stat = lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(full) !== full || stat.size > 262144) {
      throw Error();
    }
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    fail(code + '_MISSING_OR_INVALID'); return;
  }
}
const manifest = readJson('community.json', 'MANIFEST');
if (!object(manifest)) fail('MANIFEST_SHAPE');
else {
  if (manifest.schemaVersion !== 1 || !text(manifest.id) || !text(manifest.version)) fail('MANIFEST_ID_VERSION');
  if (manifest.platformCompatibility !== '^1.0.0') fail('PLATFORM_COMPATIBILITY_UNSUPPORTED');
  if (!Array.isArray(manifest.locales) || !keysEqual(Object.fromEntries(manifest.locales.map(k => [k, true])), ['de','en']) ||
      manifest.locales.length !== 2) fail('LOCALES_UNSUPPORTED');
  // Optional community branding: inherit a built-in theme and override selected colors.
  if (manifest.branding !== undefined) {
    const branding = manifest.branding;
    const themes = ['executive-glass', 'corporate-light', 'high-contrast'];
    const colorKeys = ['primary', 'secondary', 'accent'];
    if (!object(branding) || !keysEqual(branding, ['theme', 'colors']) ||
        !themes.includes(branding.theme) || !object(branding.colors) ||
        !Object.entries(branding.colors).every(([key, value]) =>
          colorKeys.includes(key) && typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))) {
      fail('BRANDING_INVALID');
    }
  }
  const cfg = manifest.assessment;
  const definition = object(cfg) ? readJson(cfg.definition, 'ASSESSMENT') : undefined;
  if (!object(definition)) fail('ASSESSMENT_SHAPE');
  else {
    if (!text(definition.instrumentId) || !text(definition.instrumentVersion) ||
        cfg.instrumentId !== definition.instrumentId || cfg.instrumentVersion !== definition.instrumentVersion) fail('ASSESSMENT_IDENTITY_MISMATCH');
    const dimensions = definition.dimensions;
    if (!Array.isArray(dimensions) || dimensions.length < 1 || dimensions.length > 20 ||
        dimensions.some(d => !text(d) || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(d)) ||
        new Set(dimensions).size !== dimensions.length) fail('ASSESSMENT_DIMENSIONS_INVALID');
    const dims = Array.isArray(dimensions) ? dimensions : [];
    const questions = definition.questions;
    if (!Array.isArray(questions) || !Number.isInteger(definition.minimumAnswersPerDimension) ||
        definition.minimumAnswersPerDimension < 1 || questions.length > 100 ||
        questions.some(q => !object(q) || !text(q.id) || !text(q.text) || !dims.includes(q.dimension)) ||
        new Set(questions.map(q => q?.id)).size !== questions.length ||
        dims.some(d => questions.filter(q => q.dimension === d).length < definition.minimumAnswersPerDimension)) {
      fail('ASSESSMENT_QUESTIONS_INVALID');
    }
    if (!object(definition.recommendationCategories) ||
        !keysEqual(definition.recommendationCategories, dims) ||
        Object.values(definition.recommendationCategories).some(v => !Array.isArray(v) || v.some(x => !/^[a-z0-9-]+$/.test(x)))) {
      fail('ASSESSMENT_RECOMMENDATIONS_INVALID');
    }
    for (const locale of ['de','en']) {
      const m = readJson('i18n/' + locale + '/method.json', 'METHOD_' + locale.toUpperCase());
      if (!object(m) || !keysEqual(m, ['assessment','journal'])) fail('METHOD_' + locale.toUpperCase() + '_UNSAFE_NAMESPACE');
      // Same key lists as the web app (METHOD_TRANSLATION_KEYS): extra wording belongs in overrides.json.
      if (object(m?.assessment) && !keysEqual(m.assessment, METHOD_KEYS.assessment)) fail('METHOD_' + locale.toUpperCase() + '_ASSESSMENT_KEYS');
      if (object(m?.journal) && !keysEqual(Object.fromEntries(Object.keys(m.journal).filter(k => k !== 'moods').map(k => [k, 1])), METHOD_KEYS.journal)) fail('METHOD_' + locale.toUpperCase() + '_JOURNAL_KEYS');
      const a = m?.assessment;
      if (!object(a) || !keysEqual(a.dimensions, dims) || !keysEqual(a.dimensionsShort, dims) ||
          !keysEqual(a.suggestions, ['strength','solid',...dims]) ||
          [a.dimensions, a.dimensionsShort, a.suggestions].some(v => !object(v) || Object.values(v).some(s => !text(s))) ||
          ['instructions','scaleTitle','introText','pathText'].some(k => !text(a[k])) ||
          !validAssessmentBands(a.bands) ||
          !validAssessmentScale(a.scale) ||
          !object(m?.journal) || ['goalsLabel','goalPlaceholder','tasksLabel','taskPlaceholder','whoLabel','whoPlaceholder','forwardLabel','forwardPlaceholder','peopleLabel','peoplePlaceholder','thoughtsLabel','thoughtsPlaceholder'].some(k => !text(m.journal[k]))) {
        fail('METHOD_' + locale.toUpperCase() + '_INCOMPLETE');
      }
    }
  }
  const journal = manifest.journal;
  const j = object(journal) ? readJson(journal.definition, 'JOURNAL') : undefined;
  if (!object(j) || !text(j.version) || !Array.isArray(j.fields) || !Array.isArray(j.categories) ||
      !Array.isArray(j.prompts) || !object(j.rotation) ||
      j.fields.some(f => !object(f) || !text(f.key) || !text(f.label) || !['text','text-list','task-list'].includes(f.kind)) ||
      j.categories.some(c => !object(c) || !text(c.id) || !text(c.label)) ||
      j.prompts.some(p => !object(p) || !text(p.id) || !text(p.text))) {
    fail('JOURNAL_DEFINITION_INVALID');
  }
  for (const locale of ['de','en']) {
    const catalog = object(journal?.translations) ? readJson(journal.translations[locale], 'JOURNAL_' + locale.toUpperCase()) : undefined;
    if (!object(catalog) || !keysEqual(catalog.fields, Array.isArray(j?.fields) ? j.fields.map(f => f.key) : []) ||
        !keysEqual(catalog.categories, Array.isArray(j?.categories) ? j.categories.map(c => c.id) : []) ||
        !keysEqual(catalog.prompts, Array.isArray(j?.prompts) ? j.prompts.map(p => p.id) : []) ||
        [catalog.fields,catalog.categories,catalog.prompts].some(v => !object(v) || Object.values(v).some(x => !text(x)))) {
      fail('JOURNAL_' + locale.toUpperCase() + '_INCOMPLETE');
    }
  }
}
// Instance texts (optional): own wording for Core texts, checked like the web app does.
const overrideFiles = ['de', 'en'].map(l => 'i18n/' + l + '/overrides.json');
if (overrideFiles.some(f => existsSync(resolve(root, f)))) {
  const coreMessages = l => JSON.parse(readFileSync(fileURLToPath(new URL('../apps/web/messages/' + l + '.json', import.meta.url)), 'utf8'));
  const overrides = {};
  for (const [i, l] of ['de', 'en'].entries()) {
    overrides[l] = existsSync(resolve(root, overrideFiles[i])) ? readJson(overrideFiles[i], 'OVERRIDES_' + l.toUpperCase()) ?? {} : {};
  }
  const problems = overrideProblems(overrides, { de: coreMessages('de'), en: coreMessages('en') });
  if (problems.length) {
    fail('OVERRIDES_INVALID');
    for (const p of problems.slice(0, 20)) console.error('  ' + p);
  } else {
    console.log('Instance texts: ' + Object.keys(flattenMessages(overrides.de)).length + ' Core texts replaced');
  }
}
if (errors.length) {
  console.error('FAIL: ' + [...new Set(errors)].join(', '));
  process.exitCode = 1;
} else console.log('PASS: instance pack compatible with Core 1.x contract (manifest, DE/EN, assessment and journal)');

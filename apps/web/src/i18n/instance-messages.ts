import type { Locale } from './config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareCompleteBilingualMethodMessages, readActiveAssessmentDimensions, readInstanceTextOverrides } from './private-method-loader';
import { applyOverrides, overrideProblems } from './instance-text-rules.mjs';

/**
 * The private method path is a trusted server deployment setting, not a
 * request/cookie/header value. Validation is bilingual and all-or-nothing.
 */
export async function loadInstanceMessages(locale: Locale) {
  const de = (await import('../../messages/de.json')).default;
  const en = (await import('../../messages/en.json')).default;
  // In the checked-out Core development demo, the versioned neutral pack is
  // the default. Production installations must explicitly select their pack.
  const demoCandidates = [
    resolve(process.cwd(), 'examples/neutral-method-pack'),
    resolve(process.cwd(), '../../examples/neutral-method-pack'),
  ];
  const demoRoot = process.env.NODE_ENV === 'development'
    ? demoCandidates.find(candidate => existsSync(resolve(candidate, 'community.json')))
    : undefined;
  const root = process.env.COMMUNITY_CONTENT_DIR || demoRoot;

  if (!root) return locale === 'de' ? de : en;

  const dimensions = await readActiveAssessmentDimensions(root);

  const result = await prepareCompleteBilingualMethodMessages(
    root, { de, en }, { dimensions },
  );

  // Instance texts: the instance's own wording for any Core text (optional).
  const [overridesDe, overridesEn] = await Promise.all([
    readInstanceTextOverrides(root, 'de'),
    readInstanceTextOverrides(root, 'en'),
  ]);
  if (overridesDe === null && overridesEn === null) return result[locale];
  const overrides = { de: overridesDe ?? {}, en: overridesEn ?? {} };
  const problems = overrideProblems(overrides, result);
  if (problems.length) throw new Error('instance texts invalid: ' + problems.slice(0, 5).join('; '));
  return applyOverrides(result[locale], overrides[locale] as Record<string, unknown>);
}

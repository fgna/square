/**
 * Require assessment method translations to match the validated, active instrument.
 */

type Messages = Record<string, unknown>;
const object = (value: unknown): value is Messages =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function exactKeys(value: unknown, expected: readonly string[], name: string): Record<string, string> {
  if (!object(value)) throw new Error(name + ': expected object');
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, i) => key !== wanted[i])) {
    throw new Error(name + ': dimension keys differ from instrument');
  }
  for (const key of wanted) {
    if (typeof value[key] !== 'string' || !(value[key] as string).trim()) {
      throw new Error(name + ': missing label for ' + key);
    }
  }
  return value as Record<string, string>;
}

function assessmentSection(messages: unknown, locale: string): Messages {
  if (!object(messages) || !object(messages.assessment)) throw new Error(locale + ': assessment translations missing');
  return messages.assessment;
}

export function verifyBilingualAssessmentMethod(
  instrument: { dimensions: string[] },
  catalogs: { de: Messages; en: Messages },
): void {
  if (instrument.dimensions.length === 0 || new Set(instrument.dimensions).size !== instrument.dimensions.length) {
    throw new Error('Invalid assessment dimensions');
  }
  for (const locale of ['de', 'en'] as const) {
    const section = assessmentSection(catalogs[locale], locale);
    exactKeys(section.dimensions, instrument.dimensions, locale + '.assessment.dimensions');
    exactKeys(section.dimensionsShort, instrument.dimensions, locale + '.assessment.dimensionsShort');
    if (!object(section.suggestions)) throw new Error(locale + ': suggestions missing');
    for (const key of ['strength', 'solid', ...instrument.dimensions]) {
      if (typeof section.suggestions[key] !== 'string' || !(section.suggestions[key] as string).trim()) {
        throw new Error(locale + ': suggestion missing for ' + key);
      }
    }
    const allowed = new Set(['strength', 'solid', ...instrument.dimensions]);
    if (Object.keys(section.suggestions).some(k => !allowed.has(k))) {
      throw new Error(locale + ': unrelated method suggestions present');
    }
  }
}

import type { JournalMethodDefinition } from './journal-method-definition';

export interface JournalMethodLocale {
  fields: Record<string, string>;
  categories: Record<string, string>;
  prompts: Record<string, string>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactTexts(value: unknown, keys: string[], label: string): Record<string, string> {
  if (!object(value)) throw new Error(label + ': expected map');
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) {
    throw new Error(label + ': keys must exactly match journal definition');
  }
  const result: Record<string, string> = {};
  for (const key of expected) {
    const text = value[key];
    if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
      throw new Error(label + ': invalid translation');
    }
    result[key] = text;
  }
  return result;
}
/** Strict, localized content must match *the same* active method and stable IDs. */
export function validateJournalMethodLocale(input: unknown, method: JournalMethodDefinition): JournalMethodLocale {
  if (!object(input) || Object.keys(input).length !== 3 ||
      !('fields' in input) || !('categories' in input) || !('prompts' in input)) {
    throw new Error('journal locale: expected fields/categories/prompts');
  }
  return {
    fields: exactTexts(input.fields, method.fields.map(f => f.key), 'journal locale fields'),
    categories: exactTexts(input.categories, method.categories.map(c => c.id), 'journal locale categories'),
    prompts: exactTexts(input.prompts, method.prompts.map(p => p.id), 'journal locale prompts'),
  };
}

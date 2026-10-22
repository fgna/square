import { describe, expect, it } from 'vitest';
import { validateJournalMethodDefinition } from './journal-method-definition';
import { validateJournalMethodLocale } from './journal-method-locale';

const method = validateJournalMethodDefinition({
  version: 'neutral-1',
  categories: [{ id: 'reflection', label: 'Reflection', color: '#112233' }],
  prompts: [{ id: 'p1', categoryId: 'reflection', text: 'Prompt', sortOrder: 0 }],
  rotation: { promptsPerDay: 1, cycle: 'day-of-year' },
  fields: [{ key: 'notes', label: 'Notes', kind: 'text' }],
});
const example = { fields: { notes: 'Notizen' }, categories: { reflection: 'Reflexion' }, prompts: { p1: 'Frage' } };
describe('journal private locale matching', () => {
  it('accepts identical stable IDs in a translated locale', () => {
    expect(validateJournalMethodLocale(example, method).fields.notes).toBe('Notizen');
  });
  it('rejects missing or unrecognized field keys', () => {
    expect(() => validateJournalMethodLocale({ ...example, fields: {} }, method)).toThrow();
    expect(() => validateJournalMethodLocale({ ...example, fields: { notes: 'N', extra: 'Oops' } }, method)).toThrow();
  });
  it('rejects missing prompts and extra categories', () => {
    expect(() => validateJournalMethodLocale({ ...example, prompts: {} }, method)).toThrow();
    expect(() => validateJournalMethodLocale({ ...example, categories: { reflection: 'R', extra: 'X' } }, method)).toThrow();
  });
  it('rejects empty and oversized translations', () => {
    expect(() => validateJournalMethodLocale({ ...example, prompts: { p1: ' ' } }, method)).toThrow();
    expect(() => validateJournalMethodLocale({ ...example, fields: { notes: 'x'.repeat(5001) } }, method)).toThrow();
  });
  it('rejects injected arbitrary keys', () => {
    expect(() => validateJournalMethodLocale({ ...example, auth: {} }, method)).toThrow();
  });
});

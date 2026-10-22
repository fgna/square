import { describe, expect, it } from 'vitest';
import { validateJournalMethodDefinition } from './journal-method-definition';

const method = {
  version: 'demo-v1',
  categories: [{ id: 'c', label: 'Neutral sample', color: '#123abc' }],
  prompts: [
    { id: 'p1', categoryId: 'c', text: 'Example one', sortOrder: 0 },
    { id: 'p2', categoryId: 'c', text: 'Example two', sortOrder: 1 },
  ],
  rotation: { promptsPerDay: 1, cycle: 'day-of-year' },
  fields: [{ key: 'notes', label: 'Notes', kind: 'text' }],
};
describe('private journal methodology definition', () => {
  it('validates a generic neutral example', () => {
    expect(validateJournalMethodDefinition(method).prompts).toHaveLength(2);
  });
  it('rejects prompts referencing unknown categories', () => {
    expect(() => validateJournalMethodDefinition({ ...method, prompts: [{ ...method.prompts[0], categoryId: 'missing' }] })).toThrow();
  });
  it('rejects duplicate rotation ordering', () => {
    expect(() => validateJournalMethodDefinition({ ...method, prompts: [method.prompts[0], { ...method.prompts[1], sortOrder: 0 }] })).toThrow();
  });
  it('rejects unsupported executable configuration', () => {
    expect(() => validateJournalMethodDefinition({ ...method, executable: './hook.js' })).toThrow();
  });
  it('rejects unsupported rotation algorithms', () => {
    expect(() => validateJournalMethodDefinition({ ...method, rotation: { promptsPerDay: 1, cycle: 'custom' } })).toThrow();
  });
  it('rejects duplicate form fields', () => {
    expect(() => validateJournalMethodDefinition({ ...method, fields: [method.fields[0], method.fields[0]] })).toThrow();
  });
  it('rejects impossible prompts-per-day', () => {
    expect(() => validateJournalMethodDefinition({ ...method, rotation: { promptsPerDay: 10, cycle: 'day-of-year' } })).toThrow();
  });
});

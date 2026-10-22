import { describe, expect, it } from 'vitest';
import { journalPromptIndices } from './journal-rotation';

function originalSelection(date: Date, n: number, count: number, stride: number) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Array.from({ length: count }, (_, i) => (day * stride + i) % n);
}
describe('legacy journal day-of-year rotation characterization', () => {
  for (const [name, date] of [
    ['New Year', new Date(2024, 0, 1, 12)],
    ['leap day', new Date(2024, 1, 29, 12)],
    ['first of March', new Date(2024, 2, 1, 12)],
    ['year end', new Date(2024, 11, 31, 12)],
    ['non-leap first of March', new Date(2025, 2, 1, 12)],
  ] as const) {
    it('matches original three-per-day rotation on ' + name, () => {
      expect(journalPromptIndices(date, 90, 3)).toEqual(originalSelection(date, 90, 3, 3));
    });
  }
  it('preserves the old three-index daily stride with fewer than three prompts', () => {
    const date = new Date(2024, 0, 3, 12);
    expect(journalPromptIndices(date, 2, 2, 3)).toEqual(originalSelection(date, 2, 2, 3));
  });
  it('supports neutral pack-specific daily quantities', () => {
    const date = new Date(2024, 0, 2, 12);
    expect(journalPromptIndices(date, 5, 1)).toEqual(originalSelection(date, 5, 1, 1));
  });
  it('rejects missing prompts, excessive daily prompts and invalid dates', () => {
    expect(() => journalPromptIndices(new Date(), 0, 1)).toThrow();
    expect(() => journalPromptIndices(new Date(), 2, 3)).toThrow();
    expect(() => journalPromptIndices(new Date('invalid'), 90, 3)).toThrow();
  });
});

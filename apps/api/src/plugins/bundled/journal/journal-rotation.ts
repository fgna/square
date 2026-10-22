/**
 * different calendar/timezone policy. This is intentionally a pure function
 * so golden dates can be checked without DB rows or private prompts.
 */
export function journalPromptIndices(date: Date, promptCount: number, promptsPerDay: number, stride = promptsPerDay): number[] {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid journal date');
  if (!Number.isInteger(promptCount) || promptCount < 1 ||
      !Number.isInteger(promptsPerDay) || promptsPerDay < 1 || promptsPerDay > promptCount || !Number.isInteger(stride) || stride < 1) {
    throw new Error('Invalid journal prompt rotation');
  }
  // Intentionally retains existing local-calendar and millisecond division behavior.
  // Changing DST handling requires a separately approved golden-parity update.
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  return Array.from({ length: promptsPerDay }, (_, i) =>
    (dayOfYear * stride + i) % promptCount
  );
}

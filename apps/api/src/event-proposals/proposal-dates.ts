/**
 * A proposed date is "start" or, with an end time, the ISO 8601 interval
 * "start/end" (e.g. "2026-11-05T18:00/2026-11-05T19:30"). The string is also
 * the key members vote with, so older proposals without an end keep working.
 */
const POINT = String.raw`\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?`;
export const PROPOSED_DATE = new RegExp(`^${POINT}(/${POINT})?$`);

/** Problems with the dates of a proposal, empty when they are fine. */
export function proposedDateProblems(dates: string[]): string[] {
  const problems: string[] = [];
  if (new Set(dates).size !== dates.length) problems.push('Each date may be proposed only once');
  for (const d of dates) {
    if (!PROPOSED_DATE.test(d)) {
      problems.push(`Invalid date: ${d}`);
      continue;
    }
    const [start, end] = d.split('/');
    if (Number.isNaN(Date.parse(start)) || (end && Number.isNaN(Date.parse(end)))) problems.push(`Invalid date: ${d}`);
    else if (end && Date.parse(end) <= Date.parse(start)) problems.push(`The end must be after the start: ${d}`);
  }
  return problems;
}

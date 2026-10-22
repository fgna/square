const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a lesson opens for a member. ALL_AT_ONCE courses open everything at
 * once; DRIP courses open each lesson `releaseAfterDays` after the member
 * started the course (their first visit). Returns null when it is open now.
 */
export function lessonAvailableAt(
  releaseMode: 'ALL_AT_ONCE' | 'DRIP',
  startedAt: Date,
  releaseAfterDays: number,
  now: Date = new Date(),
): Date | null {
  if (releaseMode !== 'DRIP' || releaseAfterDays <= 0) return null;
  const opensAt = new Date(startedAt.getTime() + releaseAfterDays * DAY_MS);
  return opensAt > now ? opensAt : null;
}

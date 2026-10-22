import type { CourseModule, Lesson } from '@community/shared';

/**
 * The lesson that follows `currentId` across module boundaries, in course
 * order. Returns null at the end of the course, or when the next lesson is a
 * drip lesson that has not opened yet — there is nothing to move on to.
 */
export function nextOpenLesson(
  modules: Pick<CourseModule, 'id' | 'lessons'>[],
  currentId: string,
): { lesson: Lesson; moduleId: string } | null {
  const ordered = modules.flatMap((m) => m.lessons.map((lesson) => ({ lesson, moduleId: m.id })));
  const index = ordered.findIndex((entry) => entry.lesson.id === currentId);
  const next = index >= 0 ? ordered[index + 1] : undefined;
  if (!next || next.lesson.locked) return null;
  return next;
}

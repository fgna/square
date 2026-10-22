import { describe, it, expect } from 'vitest';
import type { Lesson } from '@community/shared';
import { nextOpenLesson } from './next-lesson';

const lesson = (id: string, locked = false) => ({ id, locked }) as Lesson;

const modules = [
  { id: 'm1', lessons: [lesson('a'), lesson('b')] },
  { id: 'm2', lessons: [lesson('c'), lesson('d', true)] },
];

describe('nextOpenLesson', () => {
  it('moves to the next lesson in the same module', () => {
    expect(nextOpenLesson(modules, 'a')).toEqual({ lesson: modules[0].lessons[1], moduleId: 'm1' });
  });

  it('continues into the next module', () => {
    expect(nextOpenLesson(modules, 'b')).toEqual({ lesson: modules[1].lessons[0], moduleId: 'm2' });
  });

  it('stays put when the next lesson is still locked by drip', () => {
    expect(nextOpenLesson(modules, 'c')).toBeNull();
  });

  it('stays put after the last lesson', () => {
    expect(nextOpenLesson([{ id: 'm1', lessons: [lesson('a')] }], 'a')).toBeNull();
  });
});

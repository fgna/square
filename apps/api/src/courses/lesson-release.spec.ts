import { describe, it, expect } from 'vitest';
import { lessonAvailableAt } from './lesson-release';

const start = new Date('2026-09-01T10:00:00Z');

describe('lessonAvailableAt', () => {
  it('opens everything at once when the course is not dripped', () => {
    expect(lessonAvailableAt('ALL_AT_ONCE', start, 30, new Date('2026-09-02'))).toBeNull();
  });

  it('keeps a drip lesson closed until its day has come', () => {
    expect(lessonAvailableAt('DRIP', start, 7, new Date('2026-09-05T10:00:00Z'))).toEqual(
      new Date('2026-09-08T10:00:00Z'),
    );
  });

  it('opens a drip lesson once its day has come', () => {
    expect(lessonAvailableAt('DRIP', start, 7, new Date('2026-09-08T10:00:00Z'))).toBeNull();
  });

  it('opens day-0 lessons immediately', () => {
    expect(lessonAvailableAt('DRIP', start, 0, start)).toBeNull();
  });
});

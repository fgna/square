import { beforeEach, describe, expect, it } from 'vitest';
import { clearPosition, mediaKey, readPosition, resumeAt, writePosition } from './media-position';

describe('media positions', () => {
  beforeEach(() => window.localStorage.clear());

  it('identifies a file by its path, not by its expiring signature', () => {
    expect(mediaKey('/uploads/audio/a.mp3?exp=1&sig=abc')).toBe('/uploads/audio/a.mp3');
    expect(mediaKey('/uploads/audio/a.mp3?exp=2&sig=def')).toBe('/uploads/audio/a.mp3');
  });

  it('remembers the position per member', () => {
    writePosition('u1', '/a.mp3', 42.7);
    expect(readPosition('u1', '/a.mp3')).toBe(42);
    expect(readPosition('u2', '/a.mp3')).toBeNull();
    clearPosition('u1', '/a.mp3');
    expect(readPosition('u1', '/a.mp3')).toBeNull();
  });

  it('keeps only the most recent 100 files', () => {
    for (let i = 0; i < 105; i++) writePosition('u1', `/f${i}.mp3`, 10, 1000 + i);
    expect(readPosition('u1', '/f0.mp3')).toBeNull();
    expect(readPosition('u1', '/f4.mp3')).toBeNull();
    expect(readPosition('u1', '/f5.mp3')).toBe(10);
    expect(readPosition('u1', '/f104.mp3')).toBe(10);
  });

  it('survives unreadable storage', () => {
    window.localStorage.setItem('square:media-positions:u1', 'not json');
    expect(readPosition('u1', '/a.mp3')).toBeNull();
    writePosition('u1', '/a.mp3', 30);
    expect(readPosition('u1', '/a.mp3')).toBe(30);
  });

  it('starts over near the beginning or the end', () => {
    expect(resumeAt(null, 300)).toBeNull();
    expect(resumeAt(3, 300)).toBeNull();
    expect(resumeAt(120, 300)).toBe(120);
    expect(resumeAt(297, 300)).toBeNull();
    expect(resumeAt(120, NaN)).toBe(120);
  });
});

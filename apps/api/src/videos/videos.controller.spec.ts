import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { VideosController } from './videos.controller';

describe('VideosController', () => {
  it('is admin-only and not rate-limited (a video is many chunks)', () => {
    const reflector = new Reflector();
    expect(reflector.get('roles', VideosController)).toEqual(['ADMIN']);
    // Every throttler defined in app.module.ts must be skipped by name.
    for (const name of ['default', 'auth']) {
      expect(Reflect.getMetadata(`THROTTLER:SKIP${name}`, VideosController), name).toBe(true);
    }
  });
});

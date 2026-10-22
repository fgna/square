import { describe, it, expect, afterEach } from 'vitest';
import { absoluteUploadUrl } from './public-url';

describe('absoluteUploadUrl', () => {
  const original = process.env.API_URL;
  afterEach(() => {
    process.env.API_URL = original;
  });

  it('puts the API\'s public address in front of a stored upload path', () => {
    process.env.API_URL = 'https://api.example.com';
    expect(absoluteUploadUrl('/uploads/avatars/a.jpg')).toBe('https://api.example.com/uploads/avatars/a.jpg');
  });

  it('leaves full addresses alone, e.g. pictures on external storage', () => {
    expect(absoluteUploadUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });
});

import { describe, it, expect } from 'vitest';
import { readLocalFile, UnreadableFileError } from './read-local-file';

describe('readLocalFile', () => {
  it('returns an in-memory copy with the same name, type and content', async () => {
    const original = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    const copy = await readLocalFile(original);

    expect(copy).not.toBe(original);
    expect(copy.name).toBe('photo.jpg');
    expect(copy.type).toBe('image/jpeg');
    expect(copy.size).toBe(5);
  });

  it('turns a file the browser cannot read into an error that names it', async () => {
    const placeholder = new File(['x'], 'cloud-photo.jpg', { type: 'image/jpeg' });
    placeholder.arrayBuffer = () => Promise.reject(new DOMException('NotReadableError'));

    await expect(readLocalFile(placeholder)).rejects.toBeInstanceOf(UnreadableFileError);
  });
});

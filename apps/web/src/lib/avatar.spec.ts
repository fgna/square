import { describe, it, expect } from 'vitest';
import { avatarTooLargeMessage, fitWithin, shrinkAvatar, MAX_AVATAR_BYTES } from './avatar';

describe('avatarTooLargeMessage', () => {
  it('lets a photo at the limit through', () => {
    expect(avatarTooLargeMessage(MAX_AVATAR_BYTES)).toBeNull();
  });

  it('stops a larger photo before upload and says how large it is', () => {
    expect(avatarTooLargeMessage(7.3 * 1024 * 1024)).toBe(
      'Please choose an image under 5 MB — this one is 7.3 MB.',
    );
  });
});

describe('fitWithin', () => {
  it('scales a landscape phone photo down to 1024 on its long side', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1024, height: 768 });
  });

  it('scales a portrait photo by its height', () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 });
  });

  it('leaves an image that already fits unchanged', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('shrinkAvatar', () => {
  it('leaves GIFs alone, since redrawing would drop the animation', async () => {
    const gif = new File(['GIF89a'], 'wave.gif', { type: 'image/gif' });
    expect(await shrinkAvatar(gif)).toBe(gif);
  });

  it('falls back to the original file when the browser cannot decode it', async () => {
    // jsdom has no createImageBitmap, which stands in for an undecodable image.
    const photo = new File(['not really a jpeg'], 'me.jpg', { type: 'image/jpeg' });
    expect(await shrinkAvatar(photo)).toBe(photo);
  });
});

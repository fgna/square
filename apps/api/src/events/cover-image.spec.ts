import { describe, it, expect, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UnsplashCovers } from './cover-image';
import { UpdateEventDto } from './dto/update-event.dto';

describe('event cover images', () => {
  it('accepts uploaded pictures and Unsplash photos only', async () => {
    const ok = await validate(plainToInstance(UpdateEventDto, { coverUrl: '/uploads/uploads/u/pic.jpg' }));
    const unsplash = await validate(plainToInstance(UpdateEventDto, {
      coverUrl: 'https://images.unsplash.com/photo-1?w=1080',
      coverCredit: { name: 'Ann', url: 'https://unsplash.com/@ann?utm_source=square&utm_medium=referral' },
    }));
    const elsewhere = await validate(plainToInstance(UpdateEventDto, { coverUrl: 'https://tracker.example.com/pixel.gif' }));
    expect(ok).toHaveLength(0);
    expect(unsplash).toHaveLength(0);
    expect(elsewhere.map((e) => e.property)).toContain('coverUrl');
  });

  it('searches Unsplash only with a key, keeps the key on the server and credits with utm parameters', async () => {
    expect(new UnsplashCovers({}).enabled()).toBe(false);
    await expect(new UnsplashCovers({}).search('team')).rejects.toMatchObject({ status: 404 });

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: 'p1', urls: { small: 's', regular: 'r' }, user: { name: 'Ann', links: { html: 'https://unsplash.com/@ann' } }, links: { download_location: 'https://api.unsplash.com/photos/p1/download' }, alt_description: 'desk' }],
      }),
    });
    const covers = new UnsplashCovers({ UNSPLASH_ACCESS_KEY: 'k', UNSPLASH_APP_NAME: 'my-community' }, fetchFn as any);
    const [photo] = await covers.search('team');
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('Client-ID k');
    expect(photo).toMatchObject({ url: 'r', credit: { name: 'Ann', url: 'https://unsplash.com/@ann?utm_source=my-community&utm_medium=referral' } });

    await covers.markChosen('https://api.unsplash.com/photos/p1/download');
    expect(fetchFn).toHaveBeenLastCalledWith('https://api.unsplash.com/photos/p1/download', expect.anything());
    await expect(covers.markChosen('https://evil.example/download')).rejects.toMatchObject({ status: 400 });
  });
});

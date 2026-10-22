import { describe, it, expect } from 'vitest';
import { toVideoEmbed, videoDownloadPage } from './video-url';

describe('toVideoEmbed', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://vimeo.com/76979871/a1b2c3d4e5', 'https://player.vimeo.com/video/76979871?h=a1b2c3d4e5'],
    ['https://player.vimeo.com/video/76979871?h=a1b2c3', 'https://player.vimeo.com/video/76979871?h=a1b2c3'],
    ['https://www.loom.com/share/0123456789abcdef', 'https://www.loom.com/embed/0123456789abcdef'],
  ])('embeds %s', (input, embedUrl) => {
    expect(toVideoEmbed(input)?.embedUrl).toBe(embedUrl);
  });

  it.each([
    'https://example.com/video.mp4',
    'javascript:alert(1)',
    'https://www.youtube.com/watch?v=short',
    'not a url',
    'https://vimeo.com/channels/staffpicks',
  ])('rejects %s', (input) => {
    expect(toVideoEmbed(input)).toBeNull();
  });
});

describe('videoDownloadPage', () => {
  it('points to the Vimeo page, keeping the private hash', () => {
    expect(videoDownloadPage('https://vimeo.com/76979871')).toBe('https://vimeo.com/76979871');
    expect(videoDownloadPage('https://player.vimeo.com/video/76979871?h=a1b2c3')).toBe('https://vimeo.com/76979871/a1b2c3');
  });

  it('points to the Loom share page', () => {
    expect(videoDownloadPage('https://www.loom.com/embed/0123456789abcdef')).toBe('https://www.loom.com/share/0123456789abcdef');
  });

  it('offers nothing for YouTube, which has no downloads', () => {
    expect(videoDownloadPage('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
});

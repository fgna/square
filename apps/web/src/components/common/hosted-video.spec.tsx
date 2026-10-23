import { describe, it, expect } from 'vitest';
import { createEvent, fireEvent, render } from '@testing-library/react';
import { HostedVideo } from './hosted-video';

describe('HostedVideo', () => {
  it('plays the signed link without download button or context menu', () => {
    const { container } = render(<HostedVideo src="/uploads/videos/x.mp4?exp=1&sig=a" title="Lesson" />);
    const video = container.querySelector('video')!;

    expect(video.getAttribute('src')).toBe('/uploads/videos/x.mp4?exp=1&sig=a');
    expect(video.getAttribute('controlslist')).toBe('nodownload');
    const menu = createEvent.contextMenu(video);
    fireEvent(video, menu);
    expect(menu.defaultPrevented).toBe(true);
  });
});

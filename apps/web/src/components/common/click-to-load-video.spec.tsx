import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClickToLoadVideo } from './click-to-load-video';

describe('ClickToLoadVideo', () => {
  it('connects to the video host only after the click', async () => {
    render(<ClickToLoadVideo embedUrl="https://www.youtube-nocookie.com/embed/abc" title="Intro" />);

    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/connects your browser to YouTube/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load video' }));

    expect(screen.getByTitle('Intro')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc?autoplay=1');
  });

  it('asks Vimeo not to track and keeps the private-link hash', async () => {
    render(<ClickToLoadVideo embedUrl="https://player.vimeo.com/video/76979871?h=a1b2c3" title="Lesson" />);

    expect(screen.getByText(/connects your browser to Vimeo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load video' }));

    expect(screen.getByTitle('Lesson')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=a1b2c3&dnt=1&autoplay=1');
  });
});

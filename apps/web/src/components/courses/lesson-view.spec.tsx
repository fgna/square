import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Lesson } from '@community/shared';
import { LessonView, formatFileSize } from './lesson-view';

function lesson(overrides: Partial<Lesson>): Lesson {
  return {
    id: 'l1',
    title: 'Welcome',
    content: '',
    order: 1,
    moduleId: 'm1',
    createdAt: '2026-09-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('LessonView', () => {
  it('embeds the video after a click and renders the text as formatted HTML, not raw markup', async () => {
    render(
      <LessonView
        lesson={lesson({
          videoEmbedUrl: 'https://player.vimeo.com/video/76979871',
          content: '# Getting started\n\nThis is **important**.',
        })}
      />,
    );

    expect(screen.queryByTitle('Welcome')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load video' }));
    expect(screen.getByTitle('Welcome')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?dnt=1&autoplay=1');
    expect(screen.getByText('important').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*important\*\*/)).not.toBeInTheDocument();
  });

  it('lists the downloads with their size', () => {
    render(
      <LessonView
        lesson={lesson({
          attachments: [
            { id: 'a1', lessonId: 'l1', filename: 'Worksheet.pdf', url: 'http://api/w.pdf', mimeType: 'application/pdf', size: 250_000, order: 1 },
          ],
        })}
      />,
    );

    const link = screen.getByRole('link', { name: /Worksheet\.pdf/ });
    expect(link).toHaveAttribute('href', 'http://api/w.pdf');
    expect(link).toHaveTextContent('244 KB');
  });

  it('shows only the opening date for a drip lesson that has not opened', () => {
    render(<LessonView lesson={lesson({ locked: true, availableAt: '2026-09-28T10:00:00.000Z' })} />);

    expect(screen.getByText(/This lesson opens on Monday, 28 September/)).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});

describe('LessonView — download controls', () => {
  const file = (overrides: object) => ({
    id: 'a1', lessonId: 'l1', filename: 'Slides.pdf', url: 'http://api/s.pdf',
    mimeType: 'application/pdf', size: 1000, order: 1, ...overrides,
  });

  it('shows a view-only PDF in place, without a download link', () => {
    render(<LessonView lesson={lesson({ attachments: [file({ downloadable: false })] })} />);

    expect(screen.getByTitle('Slides.pdf')).toHaveAttribute('src', 'http://api/s.pdf#toolbar=0&navpanes=0');
    expect(screen.queryByRole('link', { name: /Slides\.pdf/ })).not.toBeInTheDocument();
  });

  it('plays view-only audio without offering the file', () => {
    render(
      <LessonView
        lesson={lesson({ attachments: [file({ filename: 'Meditation.mp3', url: 'http://api/m.mp3', mimeType: 'audio/mpeg', downloadable: false })] })}
      />,
    );

    const audio = document.querySelector('audio')!;
    expect(audio).toHaveAttribute('src', 'http://api/m.mp3');
    expect(audio).toHaveAttribute('controlsList', 'nodownload');
    expect(screen.queryByRole('link', { name: /Meditation/ })).not.toBeInTheDocument();
  });

  it('plays downloadable audio in the lesson and still offers the file', () => {
    render(
      <LessonView
        lesson={lesson({ attachments: [file({ filename: 'Meditation.mp3', url: 'http://api/m.mp3', mimeType: 'audio/mpeg' })] })}
      />,
    );

    const audio = document.querySelector('audio')!;
    expect(audio).toHaveAttribute('src', 'http://api/m.mp3');
    expect(audio).not.toHaveAttribute('controlsList');
    expect(screen.getByRole('link', { name: /Meditation/ })).toHaveAttribute('href', 'http://api/m.mp3');
  });

  it('links to the video host only when the admin allowed video downloads', () => {
    const { rerender } = render(<LessonView lesson={lesson({ videoEmbedUrl: 'https://player.vimeo.com/video/1' })} />);
    expect(screen.queryByRole('link', { name: /Download this video/ })).not.toBeInTheDocument();

    rerender(
      <LessonView
        lesson={lesson({ videoEmbedUrl: 'https://player.vimeo.com/video/1', videoDownloadUrl: 'https://vimeo.com/1' })}
      />,
    );
    expect(screen.getByRole('link', { name: /Download this video/ })).toHaveAttribute('href', 'https://vimeo.com/1');
  });
});

describe('formatFileSize', () => {
  it('uses a readable unit', () => {
    expect(formatFileSize(900)).toBe('900 B');
    expect(formatFileSize(3.2 * 1024 * 1024)).toBe('3.2 MB');
  });
});

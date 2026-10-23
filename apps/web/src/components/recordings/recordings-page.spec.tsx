import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordingsPage } from './recordings-page';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

const event = { id: 'e1', title: 'Workshop', startsAt: '2026-10-16T08:00:00Z', isVirtual: true };

function renderPage(recordings: unknown[]) {
  api.get.mockResolvedValue({ data: { data: recordings, totalPages: 1 } });
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordingsPage />
    </QueryClientProvider>,
  );
  return container;
}

describe('RecordingsPage', () => {
  it('plays an embeddable recording inside the platform, with no link to the video host', async () => {
    const container = renderPage([
      { id: 'r1', title: 'Session one', embedUrl: 'https://player.vimeo.com/video/123?h=abc', url: null, createdAt: '2026-10-16T10:00:00Z', event },
    ]);

    expect(await screen.findByText('Session one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load video/i })).toBeInTheDocument();
    expect(container.querySelector('a[href*="vimeo"]')).toBeNull();
  });

  it('links a recording that cannot be embedded', async () => {
    renderPage([
      { id: 'r2', title: 'Folder', embedUrl: null, url: 'https://drive.example.com/f/1', createdAt: '2026-10-16T10:00:00Z', event },
    ]);

    const links = await screen.findAllByRole('link', { name: /Folder/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', 'https://drive.example.com/f/1');
    expect(screen.queryByRole('button', { name: /load video/i })).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WelcomeVideoCard } from './welcome-video';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WelcomeVideoCard />
    </QueryClientProvider>,
  );
}

describe('WelcomeVideoCard', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset().mockResolvedValue({ data: { dismissed: true } });
  });

  it('shows the video until the member hides it', async () => {
    api.get.mockResolvedValue({
      data: { videoUrl: 'x', videoEmbedUrl: 'https://www.loom.com/embed/abc', dismissed: false },
    });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Load video' }));
    expect(screen.getByTitle('Welcome video')).toHaveAttribute('src', 'https://www.loom.com/embed/abc?autoplay=1');

    await userEvent.click(screen.getByRole('button', { name: /Hide/ }));

    expect(api.post).toHaveBeenCalledWith('/users/me/welcome/dismiss');
    await waitFor(() => expect(screen.queryByTitle('Welcome video')).not.toBeInTheDocument());
  });

  it('plays an uploaded welcome video directly from its signed link', async () => {
    api.get.mockResolvedValue({
      data: { videoEmbedUrl: null, videoFileUrl: '/uploads/videos/x.mp4?exp=1&sig=a', dismissed: false },
    });
    renderCard();

    const video = await screen.findByTitle('Welcome video');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', '/uploads/videos/x.mp4?exp=1&sig=a');
    expect(screen.queryByRole('button', { name: 'Load video' })).toBeNull();
  });

  it('stays away when no video is set, or it was hidden before', async () => {
    api.get.mockResolvedValue({ data: { videoUrl: null, videoEmbedUrl: null, dismissed: false } });
    renderCard();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Load video' })).not.toBeInTheDocument();
  });
});

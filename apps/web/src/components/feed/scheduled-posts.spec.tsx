import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduledPosts, toLocalInput } from './scheduled-posts';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

const post = { id: 'p1', content: 'Monday Motivator', type: 'DISCUSSION', authorId: 'a1', publishAt: '2099-11-02T05:00:00.000Z',
  createdAt: '2099-10-31T10:00:00.000Z', updatedAt: '2099-10-31T10:00:00.000Z', author: { id: 'a1', name: 'Peter' } };

function renderList() {
  api.get.mockResolvedValue({ data: [post] });
  api.patch.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
  render(<QueryClientProvider client={new QueryClient()}><ScheduledPosts /></QueryClientProvider>);
}

describe('ScheduledPosts', () => {
  it('lists the post with its time and publishes it now on request', async () => {
    renderList();
    expect(await screen.findByText('Monday Motivator')).toBeTruthy();
    expect(screen.getByText(/Scheduled for/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Publish now/ }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/posts/p1/schedule', { publishAt: null }));
  });

  it('moves it to another time', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /Move/ }));
    const input = screen.getByLabelText('Move') as HTMLInputElement;
    expect(input.value).toBe(toLocalInput(post.publishAt));
    fireEvent.change(input, { target: { value: '2099-11-09T06:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save time' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/posts/p1/schedule', { publishAt: new Date('2099-11-09T06:00').toISOString() }));
  });

  it('deletes it after asking', async () => {
    renderList();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(await screen.findByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/posts/p1'));
  });

  it('shows nothing when no post is scheduled', async () => {
    api.get.mockResolvedValue({ data: [] });
    const { container } = render(<QueryClientProvider client={new QueryClient()}><ScheduledPosts /></QueryClientProvider>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/posts/scheduled'));
    expect(container.textContent).toBe('');
  });
});

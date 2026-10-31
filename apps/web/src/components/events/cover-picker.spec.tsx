import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoverPicker } from './cover-picker';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

const photo = {
  id: 'p1', thumbUrl: 'https://images.unsplash.com/t1', url: 'https://images.unsplash.com/p1',
  credit: { name: 'Jane Doe', url: 'https://unsplash.com/@jane?utm_source=square&utm_medium=referral', source: 'unsplash' },
  downloadLocation: 'https://api.unsplash.com/photos/p1/download', alt: 'Team',
};

describe('CoverPicker for courses', () => {
  it('searches and reports through the course endpoints and hands back photo and credit', async () => {
    api.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/status') ? { unsplash: true } : [photo] }));
    api.post.mockResolvedValue({ data: { ok: true } });
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CoverPicker api="/courses/covers" url={null} onChange={onChange} />
      </QueryClientProvider>,
    );
    const input = await screen.findByPlaceholderText(/Unsplash/);
    fireEvent.change(input, { target: { value: 'team' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(await screen.findByTitle('Jane Doe'));
    expect(api.get).toHaveBeenCalledWith('/courses/covers/status');
    expect(api.get).toHaveBeenCalledWith('/courses/covers/search', { params: { q: 'team' } });
    expect(onChange).toHaveBeenCalledWith(photo.url, photo.credit);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/courses/covers/chosen', { downloadLocation: photo.downloadLocation }));
  });
});

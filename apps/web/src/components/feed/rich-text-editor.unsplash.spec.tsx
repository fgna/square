import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RichTextEditor } from './rich-text-editor';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

const photo = {
  id: 'p1', thumbUrl: 'https://images.unsplash.com/t1', url: 'https://images.unsplash.com/p1',
  credit: { name: 'Jane <Doe>', url: 'https://unsplash.com/@jane?utm_source=square&utm_medium=referral', source: 'unsplash' },
  downloadLocation: 'https://api.unsplash.com/photos/p1/download', alt: 'Team',
};

function renderEditor(unsplash: boolean) {
  api.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/status') ? { unsplash } : [photo] }));
  api.post.mockResolvedValue({ data: { ok: true } });
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RichTextEditor content="<p>Intro</p>" onChange={onChange} onUploadImage={vi.fn()} photoSearchApi="/courses/covers" />
    </QueryClientProvider>,
  );
  return onChange;
}

describe('RichTextEditor with Unsplash photos', () => {
  it('inserts the chosen photo with the photographer credit right below', async () => {
    const onChange = renderEditor(true);
    fireEvent.click(await screen.findByTitle('Photo from Unsplash'));
    const input = await screen.findByPlaceholderText(/Unsplash/);
    fireEvent.change(input, { target: { value: 'team' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(await screen.findByTitle('Jane <Doe>'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.calls.at(-1)![0] as string;
    expect(html).toContain('src="https://images.unsplash.com/p1"');
    expect(html).toContain('href="https://unsplash.com/@jane?utm_source=square&amp;utm_medium=referral"');
    expect(html).toContain('Jane &lt;Doe&gt;');
    expect(html).toMatch(/<img[^>]*>.*Unsplash/s);
    expect(api.post).toHaveBeenCalledWith('/courses/covers/chosen', { downloadLocation: photo.downloadLocation });
  });

  it('offers no Unsplash button when the operator did not set it up', async () => {
    renderEditor(false);
    await screen.findByTitle('Insert image');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/courses/covers/status'));
    expect(screen.queryByTitle('Photo from Unsplash')).toBeNull();
  });
});

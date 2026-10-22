import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Post } from '@community/shared';
import { EditPost, hasText, isHtmlContent } from './edit-post';

const api = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));
// The real editor needs a browser layout engine; a textarea stands in for it.
vi.mock('./rich-text-editor', () => ({
  RichTextEditor: ({ content, onChange }: { content: string; onChange: (html: string) => void }) => (
    <textarea aria-label="Rich editor" defaultValue={content} onChange={(e) => onChange(e.target.value)} />
  ),
}));

function post(content: string): Post {
  return { id: 'post-1', content } as Post;
}

function renderEditor(p: Post, onDone = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EditPost post={p} onDone={onDone} />
    </QueryClientProvider>,
  );
  return onDone;
}

describe('isHtmlContent / hasText', () => {
  it('tells rich-text posts from plain ones', () => {
    expect(isHtmlContent('<p>Hello</p>')).toBe(true);
    expect(isHtmlContent('Hello #leadership')).toBe(false);
  });

  it('treats markup without words as empty', () => {
    expect(hasText('<p></p>')).toBe(false);
    expect(hasText('  ')).toBe(false);
    expect(hasText('<p>Hi</p>')).toBe(true);
  });
});

describe('EditPost', () => {
  beforeEach(() => {
    api.put.mockReset().mockResolvedValue({ data: {} });
  });

  it('saves an edited plain post and closes the editor', async () => {
    const onDone = renderEditor(post('Helo world'));

    const box = screen.getByLabelText('Edit post');
    await userEvent.clear(box);
    await userEvent.type(box, 'Hello world  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/posts/post-1', { content: 'Hello world' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('offers the rich editor for a rich-text post', () => {
    renderEditor(post('<p>Formatted</p>'));
    expect(screen.getByLabelText('Rich editor')).toBeInTheDocument();
  });

  it('does not save an unchanged or emptied post', async () => {
    renderEditor(post('Unchanged'));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Edit post'));
    expect(save).toBeDisabled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('cancels without saving', async () => {
    const onDone = renderEditor(post('Unchanged'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDone).toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });
});

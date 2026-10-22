import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { CreatePost } from './create-post';
import enMessages from '../../../messages/en.json';

const auth = vi.hoisted(() => ({ user: { id: 'u1', name: 'Alice', role: 'MEMBER' } }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/use-feed', () => ({ useCreatePost: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('./rich-text-editor', () => ({
  RichTextEditor: ({ placeholder }: { placeholder?: string }) => <textarea aria-label="Post text" placeholder={placeholder} />,
}));

// The composer picks plain text on narrow screens; jsdom has no matchMedia.
window.matchMedia ??= ((query: string) =>
  ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);

function renderComposer() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={new QueryClient()}>
        <CreatePost />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('CreatePost', () => {
  it('announces itself as the place to write, not as another post', () => {
    renderComposer();
    expect(screen.getByRole('heading', { name: 'Create a post' })).toBeInTheDocument();
  });

  it('offers the poll before the field is clicked', async () => {
    renderComposer();

    await userEvent.click(screen.getByRole('button', { name: /Create a poll/ }));

    expect(screen.getByPlaceholderText('Poll question...')).toBeInTheDocument();
  });

  it('offers the announcement type only to admins', async () => {
    auth.user.role = 'MEMBER';
    renderComposer();
    await userEvent.click(screen.getByRole('button', { name: /Write a post/ }));
    expect(screen.queryByRole('button', { name: /Announcement/ })).not.toBeInTheDocument();
  });

  it('shows admins the announcement type', async () => {
    auth.user.role = 'ADMIN';
    renderComposer();
    await userEvent.click(screen.getByRole('button', { name: /Write a post/ }));
    expect(screen.getByRole('button', { name: /Announcement/ })).toBeInTheDocument();
  });
});

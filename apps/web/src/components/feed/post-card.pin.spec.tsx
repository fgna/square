import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostCard } from './post-card';

const api = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: { bookmarked: false } }),
  patch: vi.fn().mockResolvedValue({ data: { isPinned: true } }),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ default: api }));
const auth = vi.hoisted(() => ({ user: { id: 'u1', role: 'ADMIN' } as { id: string; role: string } }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));

const post: any = {
  id: 'p1',
  content: 'Hallo',
  type: 'DISCUSSION',
  authorId: 'someone-else',
  author: { id: 'someone-else', name: 'Ann', avatarUrl: null, role: 'MEMBER' },
  isPinned: false,
  createdAt: new Date().toISOString(),
  _count: { comments: 0, reactions: 0 },
  reactions: [],
};

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PostCard post={post} />
    </QueryClientProvider>,
  );
}

describe('PostCard pinning', () => {
  it('lets admins pin a post to the top of the feed', async () => {
    auth.user = { id: 'u1', role: 'ADMIN' };
    renderCard();
    await userEvent.click(screen.getAllByRole('button')[0]);
    await userEvent.click(await screen.findByText('Pin to top'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/posts/p1/pin'));
  });

  it('offers members no pinning', async () => {
    auth.user = { id: 'u2', role: 'MEMBER' };
    renderCard();
    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.queryByText('Pin to top')).toBeNull();
  });
});

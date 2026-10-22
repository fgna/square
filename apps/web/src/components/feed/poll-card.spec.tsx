import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Poll } from '@community/shared';
import { NextIntlClientProvider } from 'next-intl';
import { PollCard } from './poll-card';
import enMessages from '../../../messages/en.json';

const api = vi.hoisted(() => ({
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ default: api }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

function poll(votedOptionId?: string): Poll {
  return {
    id: 'poll-1',
    question: 'Which day suits you?',
    createdAt: '2026-09-21T00:00:00.000Z',
    options: [
      {
        id: 'opt-a',
        text: 'Monday',
        order: 0,
        _count: { votes: votedOptionId === 'opt-a' ? 1 : 0 },
      },
      { id: 'opt-b', text: 'Friday', order: 1, _count: { votes: 0 } },
    ],
    votes: votedOptionId ? [{ optionId: votedOptionId }] : [],
  };
}

function renderPoll(p: Poll) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={client}>
        <PollCard poll={p} postId="post-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('PollCard voting', () => {
  beforeEach(() => {
    api.post.mockReset().mockResolvedValue({ data: {} });
    api.delete.mockReset().mockResolvedValue({ data: {} });
  });

  it('casts a vote on the first click, rather than retracting one', async () => {
    renderPoll(poll());

    await userEvent.click(screen.getByRole('button', { name: /Monday/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/posts/post-1/poll/vote', {
        optionId: 'opt-a',
      }),
    );
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('retracts when the member clicks the option they already chose', async () => {
    renderPoll(poll('opt-a'));

    await userEvent.click(screen.getByRole('button', { name: /Monday/ }));

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/posts/post-1/poll/vote'),
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('changes the vote when a different option is clicked', async () => {
    renderPoll(poll('opt-a'));

    await userEvent.click(screen.getByRole('button', { name: /Friday/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/posts/post-1/poll/vote', {
        optionId: 'opt-b',
      }),
    );
    expect(api.delete).not.toHaveBeenCalled();
  });
});

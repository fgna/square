import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorePage } from './explore-page';

const category = vi.hoisted(() => (id: string, name: string) => ({
  id, name, slug: id, description: null, icon: null, color: null,
  _count: { posts: 1, courses: 0, events: 0 },
}));

vi.mock('@/lib/api-client', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [category('lead', 'Leadership'), category('ai', 'AI'), category('team', 'Teamwork')] }) },
}));
const interests = vi.hoisted(() => ({ data: [] as { id: string; name: string; slug: string }[] }));
vi.mock('@/hooks/use-interests', () => ({ useInterests: () => ({ data: interests.data, isLoading: false }) }));

function renderExplore() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExplorePage />
    </QueryClientProvider>,
  );
}

describe('Explore', () => {
  beforeEach(() => {
    interests.data = [];
  });

  it('puts the member’s interests first', async () => {
    interests.data = [{ id: 'team', name: 'Teamwork', slug: 'team' }];
    renderExplore();
    const mine = (await screen.findByRole('heading', { name: 'Your interests' })).closest('section')!;
    expect(within(mine).getByText('Teamwork')).toBeInTheDocument();
    expect(within(mine).queryByText('AI')).not.toBeInTheDocument();
    const others = screen.getByRole('heading', { name: 'More topics' }).closest('section')!;
    expect(within(others).getByText('AI')).toBeInTheDocument();
  });

  it('points to the settings when no interests are picked', async () => {
    renderExplore();
    await screen.findByText('AI');
    expect(screen.getByRole('link', { name: 'Choose interests' })).toHaveAttribute('href', '/settings#interests');
    expect(screen.queryByRole('heading', { name: 'Your interests' })).not.toBeInTheDocument();
  });
});

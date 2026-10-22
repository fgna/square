import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FeedPage from './page';

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/feed',
  useSearchParams: () => nav.params,
}));

const useFeed = vi.hoisted(() => vi.fn(() => ({ data: { data: [] }, isLoading: false })));
vi.mock('@/hooks/use-feed', () => ({ useFeed }));
vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock('@/components/feed/create-post', () => ({
  CreatePost: ({ initialType }: { initialType?: string }) => <div data-testid="composer">{initialType ?? 'none'}</div>,
}));
vi.mock('@/components/feed/upcoming-events-strip', () => ({ UpcomingEventsStrip: () => <div>events strip</div> }));
vi.mock('@/components/event-proposals/event-proposals-section', () => ({ EventProposalsSection: () => null }));

function renderForum() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FeedPage />
    </QueryClientProvider>,
  );
}

describe('Forum', () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
    nav.replace.mockClear();
    useFeed.mockClear();
  });

  it('shows all posts with events by default', () => {
    renderForum();
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    expect(useFeed).toHaveBeenCalledWith(1, 50, undefined, 'interests');
    expect(screen.getByText('events strip')).toBeInTheDocument();
  });

  it('switches to a tab through the address, so it can be linked', async () => {
    renderForum();
    await userEvent.click(screen.getByRole('tab', { name: 'Questions' }));
    expect(nav.replace).toHaveBeenCalledWith('/feed?type=QUESTION', { scroll: false });
  });

  it('filters by the tab and writes new posts of that kind', () => {
    nav.params = new URLSearchParams('type=SUCCESS_STORY');
    renderForum();
    expect(screen.getByRole('tab', { name: 'Success stories' })).toHaveAttribute('aria-selected', 'true');
    expect(useFeed).toHaveBeenCalledWith(1, 50, 'SUCCESS_STORY', 'interests');
    expect(screen.getByTestId('composer')).toHaveTextContent('SUCCESS_STORY');
    expect(screen.queryByText('events strip')).not.toBeInTheDocument();
    expect(screen.getByText('No success stories yet')).toBeInTheDocument();
  });

  it('orders the tabs along a member’s way in, introductions first', () => {
    renderForum();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All', 'Introductions', 'Questions', 'Discussions', 'Topic suggestions', 'Success stories',
    ]);
  });

  it('collects introductions in their own tab', () => {
    nav.params = new URLSearchParams('type=INTRODUCTION');
    renderForum();
    expect(useFeed).toHaveBeenCalledWith(1, 50, 'INTRODUCTION', 'interests');
    expect(screen.getByTestId('composer')).toHaveTextContent('INTRODUCTION');
  });

  it('ignores an unknown type in the address', () => {
    nav.params = new URLSearchParams('type=ANNOUNCEMENT');
    renderForum();
    expect(useFeed).toHaveBeenCalledWith(1, 50, undefined, 'interests');
  });
});

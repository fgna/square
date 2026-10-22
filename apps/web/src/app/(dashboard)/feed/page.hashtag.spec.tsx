import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import FeedPage from './page';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../../messages/en.json';

// PostCard dispatches `feed:hashtag` on a hashtag click and the feed listens
// for it. That wiring is the point of these tests: the event existed for
// months with no listener mounted, so every hashtag click silently did
// nothing. A unit test is the only thing that catches that going missing
// again — types and lint never noticed.

const mockUseFeed = vi.fn();

// The forum reads its tab from the address.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/feed',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/use-feed', () => ({
  useFeed: (...args: unknown[]) => mockUseFeed(...args),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { hasIntroduced: true } }),
}));

vi.mock('@/lib/api-client', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock('@/components/common/page-header', () => ({
  PageHeader: () => null,
}));

vi.mock('@/components/feed/create-post', () => ({
  CreatePost: () => null,
}));

vi.mock('@/components/feed/introduction-banner', () => ({
  IntroductionBanner: () => null,
}));

vi.mock('@/components/common/loading-skeleton', () => ({
  PostSkeleton: () => null,
}));

vi.mock('@/components/common/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty">{title}</div>,
}));

// Both strips fetch on their own; the hashtag tests are about the post list.
vi.mock('@/components/feed/upcoming-events-strip', () => ({ UpcomingEventsStrip: () => null }));
vi.mock('@/components/event-proposals/event-proposals-section', () => ({ EventProposalsSection: () => null }));
vi.mock('@/components/feed/post-card', () => ({
  PostCard: ({ post }: { post: { id: string; content: string } }) => (
    <div data-testid="post">{post.content}</div>
  ),
}));

// FeedPage now reads next-intl at render time; tests must supply the same
// provider contract as the application without mocking away translations.
const renderFeed = () => render(
  <NextIntlClientProvider locale="en" messages={enMessages}>
    <FeedPage />
  </NextIntlClientProvider>,
);

const posts = [
  { id: '1', content: 'Morning run done #Fitness' },
  { id: '2', content: 'Tried a new recipe #cooking' },
  { id: '3', content: 'No tags in this one' },
];

const clickHashtag = (tag: string) =>
  act(() => {
    window.dispatchEvent(new CustomEvent('feed:hashtag', { detail: tag }));
  });

const shownPosts = () => screen.queryAllByTestId('post').map((n) => n.textContent);

describe('FeedPage hashtag filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeed.mockReturnValue({ data: { data: posts }, isLoading: false });
  });

  it('asks the API to prioritise the member\'s interests', () => {
    renderFeed();
    expect(mockUseFeed).toHaveBeenCalledWith(1, 50, undefined, 'interests');
  });

  it('shows every post when no hashtag is selected', () => {
    renderFeed();
    expect(shownPosts()).toHaveLength(3);
  });

  it('filters to posts carrying the clicked hashtag', () => {
    renderFeed();
    clickHashtag('#fitness');

    // '#Fitness' in the post, '#fitness' from the click — extractHashtags
    // lowercases both, so the match must survive the difference in case.
    expect(shownPosts()).toEqual(['Morning run done #Fitness']);
  });

  it('offers a way back out of the filter', () => {
    renderFeed();
    clickHashtag('#cooking');
    expect(shownPosts()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /#cooking/ }));
    expect(shownPosts()).toHaveLength(3);
  });

  it('says the filter is what emptied the list, not the community', () => {
    renderFeed();
    clickHashtag('#nobodyusedthis');

    expect(shownPosts()).toHaveLength(0);
    expect(screen.getByTestId('empty')).toHaveTextContent('No posts tagged #nobodyusedthis');
  });
});

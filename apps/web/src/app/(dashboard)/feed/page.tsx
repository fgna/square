'use client';

import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle, HelpCircle, Trophy, MessageSquare, LayoutList, Hand, Lightbulb, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/page-header';
import { CreatePost } from '@/components/feed/create-post';
import { PostCard } from '@/components/feed/post-card';
import { PostSkeleton } from '@/components/common/loading-skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { IntroductionBanner } from '@/components/feed/introduction-banner';
import { UpcomingEventsStrip } from '@/components/feed/upcoming-events-strip';
import { EventProposalsSection } from '@/components/event-proposals/event-proposals-section';
import { useFeed } from '@/hooks/use-feed';
import { extractHashtags } from '@/lib/markdown';
import apiClient from '@/lib/api-client';

// Questions, success stories and the feed used to be three pages over the same
// posts, and members did not know where to write — so they wrote nothing.
// The forum is one page; the tabs only filter by post type.
type ForumTab = 'INTRODUCTION' | 'QUESTION' | 'DISCUSSION' | 'TOPIC_SUGGESTION' | 'SUCCESS_STORY';

// Ordered along a member's way in: arrive and introduce yourself, ask, join
// the conversation, suggest what the community should take up next, share
// what came of it. Introductions come first so new members are seen and welcomed.
const TABS: { value: ForumTab | undefined; key: string; icon: LucideIcon }[] = [
  { value: undefined, key: 'all', icon: LayoutList },
  { value: 'INTRODUCTION', key: 'introductions', icon: Hand },
  { value: 'QUESTION', key: 'questions', icon: HelpCircle },
  { value: 'DISCUSSION', key: 'discussions', icon: MessageSquare },
  { value: 'TOPIC_SUGGESTION', key: 'topics', icon: Lightbulb },
  { value: 'SUCCESS_STORY', key: 'successStories', icon: Trophy },
];

const EMPTY_ICONS: Record<string, LucideIcon> = {
  all: MessageCircle,
  introductions: Hand,
  questions: HelpCircle,
  discussions: MessageSquare,
  topics: Lightbulb,
  successStories: Trophy,
};

function isForumTab(value: string | null): value is ForumTab {
  return TABS.some((tab) => tab.value !== undefined && tab.value === value);
}

function ForumPage() {
  const t = useTranslations('feed');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const activeType = isForumTab(typeParam) ? typeParam : undefined;
  const activeTab = TABS.find((tab) => tab.value === activeType) ?? TABS[0];

  // Posts on the member's interests come first; without interests the
  // API keeps the plain newest-first order (#104, #117).
  const { data, isLoading } = useFeed(1, 50, activeType, 'interests');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // PostCard dispatches this when a hashtag inside a post is clicked (#115).
  useEffect(() => {
    const handler = (e: Event) => setActiveTag((e as CustomEvent).detail);
    window.addEventListener('feed:hashtag', handler);
    return () => window.removeEventListener('feed:hashtag', handler);
  }, []);

  const posts = data?.data;
  const visiblePosts = activeTag
    ? posts?.filter((post) => extractHashtags(post.content).includes(activeTag))
    : posts;
  const [introType, setIntroType] = useState<'INTRODUCTION' | undefined>(undefined);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('intro-banner-dismissed') === '1';
    }
    return false;
  });

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/users/me').then((r) => r.data),
    staleTime: 60_000,
  });

  const showBanner = profile && !profile.hasIntroduced && !dismissed;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('intro-banner-dismissed', '1');
  };

  const handleIntroduce = () => {
    setIntroType('INTRODUCTION');
  };

  const selectTab = (value: ForumTab | undefined) => {
    router.replace(value ? `${pathname}?type=${value}` : pathname, { scroll: false });
  };

  // A new post starts as the kind of post the member is looking at.
  const composerType = introType ?? activeType;
  const EmptyIcon = EMPTY_ICONS[activeTab.key];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      <div role="tablist" aria-label={t('forum.tabsLabel')} className="flex gap-1 overflow-x-auto">
        {TABS.map(({ value, key, icon: Icon }) => {
          const selected = value === activeType;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTab(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                background: selected ? 'rgba(197,168,128,0.12)' : 'transparent',
                color: selected ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                border: selected ? '1px solid rgba(197,168,128,0.2)' : '1px solid transparent',
              }}
            >
              <Icon size={14} />
              {t(`forum.tabs.${key}`)}
            </button>
          );
        })}
      </div>

      {/* Members suggest topics for events, masterclasses and content; the
          discussion runs in the comments, reactions show support. */}
      {activeType === 'TOPIC_SUGGESTION' && (
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('forum.topicsHint')}</p>
      )}

      {/* Writing comes first. With events, proposals and the welcome banner
          above it, the composer and the newest posts slid below the fold and
          members overlooked both (found in testing). */}
      <CreatePost
        key={composerType ?? 'default'}
        initialType={composerType}
        initialFocused={!!introType}
      />

      {/* Banner, events and proposals belong to the overview; in a filtered
          tab they would push the matching posts down. */}
      {!activeType && (
        <>
          {showBanner && (
            <IntroductionBanner onIntroduce={handleIntroduce} onDismiss={handleDismiss} />
          )}

          {/* Events still come before posts — they are the only content with a
              deadline — but as a compact strip. */}
          <UpcomingEventsStrip />

          {/* Proposals reach members where they already are, collapsed to one
              line until opened so they do not push the posts down. */}
          <EventProposalsSection compact />
        </>
      )}

      {activeTag && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('filteredBy')}</span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
            style={{ background: 'rgba(197,168,128,0.12)', color: 'var(--theme-primary)' }}
          >
            {activeTag} <X size={11} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <PostSkeleton key={i} />)}
        </div>
      ) : visiblePosts?.length === 0 && activeTag ? (
        <EmptyState
          icon={MessageCircle}
          title={t('noTaggedPosts', { tag: activeTag })}
          description={t('noTaggedPostsDescription')}
        />
      ) : visiblePosts?.length === 0 ? (
        <EmptyState
          icon={EmptyIcon}
          title={t(`forum.empty.${activeTab.key}.title`)}
          description={t(`forum.empty.${activeTab.key}.text`)}
        />
      ) : (
        <div className="space-y-4">
          {visiblePosts?.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      )}
    </div>
  );
}

// useSearchParams needs a Suspense boundary, or the build refuses to
// prerender the page.
export default function FeedPage() {
  return (
    <Suspense>
      <ForumPage />
    </Suspense>
  );
}

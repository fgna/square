'use client';

import { Users, MessageCircle, BookOpen, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatsCard } from '@/components/common/stats-card';
import { PageHeader } from '@/components/common/page-header';
import { useAuth } from '@/hooks/use-auth';
import { useFeed } from '@/hooks/use-feed';
import { useCourses } from '@/hooks/use-courses';
import { useEvents } from '@/hooks/use-events';
import { useMembers } from '@/hooks/use-members';
import { PostCard } from '@/components/feed/post-card';
import { EventCard } from '@/components/events/event-card';
import { PostSkeleton } from '@/components/common/loading-skeleton';
import { MyChallenge } from '@/components/dashboard/my-challenge';
import { MyGoals } from '@/components/dashboard/my-goals';
import { EventProposalsSection } from '@/components/event-proposals/event-proposals-section';
import { WelcomeVideoCard } from '@/components/onboarding/welcome-video';
import { enabledCapabilities } from '@/lib/capabilities';

export default function DashboardPage() {
  const { user } = useAuth();
  const showFeed = enabledCapabilities.has('feed');
  const showEvents = enabledCapabilities.has('events');
  const showCourses = enabledCapabilities.has('courses');
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const { data: feedData, isLoading: feedLoading, isError: feedError } = useFeed(1, 3, undefined, undefined, showFeed);
  const { data: coursesData, isError: coursesError } = useCourses(1, 1);
  const { data: eventsData, isLoading: eventsLoading, isError: eventsError } = useEvents(1, 3, showEvents);
  const { data: membersData, isError: membersError } = useMembers(1, 1);

  const upcomingEvents = eventsData?.data?.filter(
    (e) => new Date(e.startsAt) > new Date()
  ).slice(0, 2) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('welcomeBack', { name: user?.name?.split(' ')[0] ?? 'there' })}
        description={t('subtitle')}
      />

      <WelcomeVideoCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MyChallenge />
        <MyGoals />
      </div>

      {(showFeed || showEvents) && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent posts */}
        {showFeed && (
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
            {t('recentPosts')}
          </h3>
          {feedLoading ? (
            <div className="space-y-4">{[1, 2].map((i) => <PostSkeleton key={i} />)}</div>
          ) : feedError ? (
            <p className="text-sm py-4" style={{ color: 'var(--theme-danger, #ef4444)' }}>
              {t('failedPosts')}. <button className="underline" onClick={() => window.location.reload()}>{tc('retry')}</button>
            </p>
          ) : (
            <div className="space-y-4">
              {feedData?.data?.slice(0, 3).map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        )}
        {/* Upcoming events */}
        {showEvents && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
            {t('upcomingEvents')}
          </h3>
          {eventsLoading ? (
            <div className="space-y-4">{[1, 2].map((i) => <PostSkeleton key={i} />)}</div>
          ) : eventsError ? (
            <p className="text-sm py-4" style={{ color: 'var(--theme-danger, #ef4444)' }}>
              {t('failedEvents')}. <button className="underline" onClick={() => window.location.reload()}>{tc('retry')}</button>
            </p>
          ) : upcomingEvents.length > 0 ? (
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('noUpcomingEvents')}</p>
          )}
          <EventProposalsSection compact />
        </div>
        )}
      </div>}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t('totalMembers')}
          value={membersError ? '!' : (membersData?.total ?? '—')}
          icon={Users}
          description={membersError ? t('failedPosts') : t('totalMembersDesc')}
        />
        {showFeed && <StatsCard
          title={t('communityPosts')}
          value={feedError ? '!' : (feedData?.total ?? '—')}
          icon={MessageCircle}
          description={feedError ? t('failedPosts') : t('communityPostsDesc')}
        />}
        {showCourses && <StatsCard
          title={t('availableCourses')}
          value={coursesError ? '!' : (coursesData?.total ?? '—')}
          icon={BookOpen}
          description={coursesError ? t('failedPosts') : t('availableCoursesDesc')}
        />}
        {showEvents && <StatsCard
          title={t('upcomingEventsCard')}
          value={eventsError ? '!' : upcomingEvents.length}
          icon={Calendar}
          description={eventsError ? t('failedEvents') : t('upcomingEventsCardDesc')}
        />}
      </div>
    </div>
  );
}

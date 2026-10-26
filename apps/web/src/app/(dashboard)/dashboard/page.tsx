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
import { PostSkeleton } from '@/components/common/loading-skeleton';
import { MyChallenge } from '@/components/dashboard/my-challenge';
import { MyGoals } from '@/components/dashboard/my-goals';
import { EventProposalsSection } from '@/components/event-proposals/event-proposals-section';
import { WelcomeVideoCard } from '@/components/onboarding/welcome-video';
import { MonthOverview } from '@/components/dashboard/month-overview';

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const { data: feedData, isLoading: feedLoading, isError: feedError } = useFeed(1, 3);
  const { data: coursesData, isError: coursesError } = useCourses(1, 1);
  // The API returns only events that have not ended, soonest first.
  const { data: eventsData, isError: eventsError } = useEvents(1, 1, { when: 'upcoming' });
  const { data: membersData, isError: membersError } = useMembers(1, 1);


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

      {/* One place for events: the next 30 days, then open date polls. */}
      <MonthOverview />
      <EventProposalsSection compact />

      <div className="space-y-4">
        {/* Recent posts */}
        <div className="space-y-4">
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

      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t('totalMembers')}
          value={membersError ? '!' : (membersData?.total ?? '—')}
          icon={Users}
          description={membersError ? t('failedPosts') : t('totalMembersDesc')}
        />
        <StatsCard
          title={t('communityPosts')}
          value={feedError ? '!' : (feedData?.total ?? '—')}
          icon={MessageCircle}
          description={feedError ? t('failedPosts') : t('communityPostsDesc')}
        />
        <StatsCard
          title={t('availableCourses')}
          value={coursesError ? '!' : (coursesData?.total ?? '—')}
          icon={BookOpen}
          description={coursesError ? t('failedPosts') : t('availableCoursesDesc')}
        />
        <StatsCard
          title={t('upcomingEventsCard')}
          value={eventsError ? '!' : (eventsData?.total ?? '—')}
          icon={Calendar}
          description={eventsError ? t('failedEvents') : t('upcomingEventsCardDesc')}
        />
      </div>
    </div>
  );
}

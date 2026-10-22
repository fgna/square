'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@community/shared';
import {
  Users, FileText, BookOpen, Calendar, MessageSquare,
  TrendingUp, UserCheck, BarChart2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Analytics {
  users: { total: number; active: number; newLast30d: number; newLast7d: number };
  content: { posts: number; postsLast30d: number; postsLast7d: number; comments: number; reactions: number };
  courses: { total: number; published: number };
  events: { total: number; upcoming: number; totalRsvps: number };
  messages: { total: number; conversations: number };
  topPostAuthors: { id?: string; name?: string; avatarUrl?: string | null; postCount: number }[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'var(--theme-primary)',
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
              {label}
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: 'var(--theme-text)' }}>
              {value}
            </p>
            {sub && (
              <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                {sub}
              </p>
            )}
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}18` }}
          >
            <Icon size={20} style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--theme-border)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations('adminAnalyticsUI');
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ['admin', 'analytics'],
    queryFn: () => apiClient.get('/admin/analytics').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxAuthorPosts = data.topPostAuthors[0]?.postCount ?? 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      {/* Users */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-muted)' }}>
          {t('members')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label={t('totalMembers')} value={data.users.total} />
          <StatCard icon={UserCheck} label={t('activeMembers')} value={data.users.active} sub={t('ofTotal', {percent: Math.round(data.users.active / Math.max(data.users.total, 1) * 100)})} color="#22c55e" />
          <StatCard icon={TrendingUp} label={t('new30')} value={data.users.newLast30d} color="#3b82f6" />
          <StatCard icon={TrendingUp} label={t('new7')} value={data.users.newLast7d} color="#8b5cf6" />
        </div>
      </div>

      {/* Content */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-muted)' }}>
          {t('content')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={FileText} label={t('totalPosts')} value={data.content.posts} />
          <StatCard icon={FileText} label={t('posts30')} value={data.content.postsLast30d} color="#f59e0b" />
          <StatCard icon={BarChart2} label={t('comments')} value={data.content.comments} color="#ec4899" />
          <StatCard icon={BarChart2} label={t('reactions')} value={data.content.reactions} color="#ef4444" />
        </div>
      </div>

      {/* Courses & Events */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-muted)' }}>
          {t('coursesEvents')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={BookOpen} label={t('totalCourses')} value={data.courses.total} />
          <StatCard icon={BookOpen} label={t('published')} value={data.courses.published} color="#22c55e" />
          <StatCard icon={Calendar} label={t('totalEvents')} value={data.events.total} />
          <StatCard icon={Calendar} label={t('upcoming')} value={data.events.upcoming} color="#3b82f6" sub={t('rsvps', {count: data.events.totalRsvps})} />
        </div>
      </div>

      {/* Messaging */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-muted)' }}>
          {t('messaging')}
        </h3>
        <div className="grid grid-cols-2 gap-4 md:w-1/2">
          <StatCard icon={MessageSquare} label={t('totalMessages')} value={data.messages.total} />
          <StatCard icon={MessageSquare} label={t('conversations')} value={data.messages.conversations} color="#8b5cf6" />
        </div>
      </div>

      {/* Top authors */}
      {data.topPostAuthors.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-muted)' }}>
            {t('mostActive')}
          </h3>
          <Card>
            <CardContent className="p-0">
              {data.topPostAuthors.map((author, idx) => (
                <div
                  key={author.id ?? idx}
                  className="flex items-center gap-4 px-5 py-3"
                  style={{ borderBottom: idx < data.topPostAuthors.length - 1 ? '1px solid var(--theme-border)' : undefined }}
                >
                  <span className="text-sm font-mono w-5 text-center" style={{ color: 'var(--theme-text-muted)' }}>
                    {idx + 1}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={author.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(author.name ?? '?')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {author.name ?? t('unknown')}
                    </p>
                    <MiniBar value={author.postCount} max={maxAuthorPosts} color="var(--theme-primary)" />
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--theme-primary)' }}>
                    {t('postsCount', {count: author.postCount})}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

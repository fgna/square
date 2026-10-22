'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Users, MessageCircle, BookOpen, Calendar, TrendingUp, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { StatsCard } from '@/components/common/stats-card';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiClient.get('/admin/stats').then((r) => r.data),
  });
}

export default function AdminDashboardPage() {
  const t = useTranslations('adminDashboardUI');
  const { data: stats, isLoading } = useAdminStats();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Shield}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : (
          <>
            <Link href="/admin/users" aria-label={t('manageUsers')} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current [&>*]:h-full"><StatsCard title={t('users')} value={stats?.users ?? 0} icon={Users} description={t('usersDesc')} /></Link>
            <StatsCard title={t('posts')} value={stats?.posts ?? 0} icon={MessageCircle} description={t('postsDesc')} />
            <Link href="/admin/courses" aria-label={t('publish')} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current [&>*]:h-full"><StatsCard title={t('courses')} value={stats?.courses ?? 0} icon={BookOpen} description={t('coursesDesc')} /></Link>
            <Link href="/admin/events" aria-label={t('createEvent')} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current [&>*]:h-full"><StatsCard title={t('events')} value={stats?.events ?? 0} icon={Calendar} description={t('eventsDesc')} /></Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text-muted)' }}>
              <TrendingUp size={14} /> {t('health')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'API', status: t('operational') },
              { label: t('database'), status: t('operational') },
              { label: t('auth'), status: t('operational') },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--theme-text)' }}>{label}</span>
                <Badge className="bg-green-500/15 text-green-400 border-green-500/20">{status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
          <CardHeader>
            <CardTitle className="text-sm font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
              {t('actions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: t('manageUsers'), href: '/admin/users' },
              { label: t('review'), href: '/admin/moderation' },
              { label: t('publish'), href: '/admin/courses' },
              { label: t('createEvent'), href: '/admin/events' },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="block px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--theme-primary)', background: 'rgba(197,168,128,0.05)' }}
              >
                {label} →
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

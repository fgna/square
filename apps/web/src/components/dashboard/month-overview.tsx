'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Play, Repeat } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useEvents } from '@/hooks/use-events';
import { useFormatters } from '@/lib/use-formatters';
import type { CommunityEvent } from '@community/shared';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The next 30 days at a glance, and recordings of the last two weeks. A
 * recurring series appears once, with its next date, so a daily series does
 * not hide the one-off events.
 */
export function MonthOverview() {
  const t = useTranslations('dashboard.month');
  const { formatDate, formatTime } = useFormatters();
  // Rounded to the minute so the query key stays stable between renders.
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  const { data: events, isLoading } = useEvents(1, 100, {
    from: new Date(now).toISOString(),
    to: new Date(now + 30 * DAY).toISOString(),
  });
  const { data: recordings } = useQuery({
    queryKey: ['recordings', 'recent'],
    queryFn: () => apiClient.get('/events/recordings/all', { params: { page: 1, limit: 5 } }).then((r) => r.data),
  });

  const seen = new Set<string>();
  const upcoming = ((events?.data ?? []) as CommunityEvent[]).filter((e) => {
    const key = e.seriesId ?? e.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const recent = ((recordings?.data ?? []) as { id: string; title: string; createdAt: string; event?: { title: string } }[])
    .filter((r) => now - new Date(r.createdAt).getTime() < 14 * DAY)
    .slice(0, 3);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-label={t('title')}>
      <div className="lg:col-span-2 rounded-xl p-5 space-y-3" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
            <CalendarDays size={18} /> {t('title')}
          </h3>
          <Link href="/events" className="text-xs underline" style={{ color: 'var(--theme-text-muted)' }}>{t('allEvents')}</Link>
        </div>
        {isLoading ? null : upcoming.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('empty')}</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link href={`/events#event-${e.id}`} className="flex items-baseline gap-3 py-2 text-sm hover:underline">
                  <span className="w-28 flex-shrink-0 tabular-nums" style={{ color: 'var(--theme-text-muted)' }}>
                    {formatDate(e.startsAt)} {formatTime(e.startsAt)}
                  </span>
                  <span className="flex-1" style={{ color: 'var(--theme-text)' }}>{e.title}</span>
                  {e.seriesId && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      <Repeat size={12} /> {t('recurring')}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
            <Play size={18} /> {t('recordings')}
          </h3>
          <Link href="/recordings" className="text-xs underline" style={{ color: 'var(--theme-text-muted)' }}>{t('allRecordings')}</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('noRecordings')}</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href="/recordings" className="block text-sm hover:underline" style={{ color: 'var(--theme-text)' }}>
                  {r.title}
                  {r.event?.title && <span className="block text-xs" style={{ color: 'var(--theme-text-muted)' }}>{r.event.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

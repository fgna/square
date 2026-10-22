'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Calendar, MapPin, Video, ArrowRight, Repeat } from 'lucide-react';
import { useEvents } from '@/hooks/use-events';
import { useInterests } from '@/hooks/use-interests';
import { useFormatters } from '@/lib/use-formatters';
import { Skeleton } from '@/components/ui/skeleton';
import type { CommunityEvent } from '@community/shared';

const MAX_SHOWN = 3;

/**
 * Events sit above everything else in the feed: they are the only content with
 * a deadline, so burying them under posts means members miss them.
 */
export function UpcomingEventsStrip() {
  const t = useTranslations('feed');
  const { formatDate, formatTime } = useFormatters();
  const { data, isLoading } = useEvents(1, 50);
  const { data: interests } = useInterests();

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="flex gap-3">
          <Skeleton className="h-16 flex-1" />
          <Skeleton className="h-16 flex-1" />
        </div>
      </div>
    );
  }

  // Events on the member's interests come first, each group soonest first.
  const interestIds = new Set((interests ?? []).map((i) => i.id));
  const onInterests = (event: CommunityEvent) =>
    (event.categories ?? []).some((c) => interestIds.has(c.category.id));
  const now = Date.now();
  const upcoming = ((data?.data ?? []) as CommunityEvent[])
    .filter((event) => new Date(event.startsAt).getTime() >= now)
    .sort(
      (a, b) =>
        Number(onInterests(b)) - Number(onInterests(a)) ||
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, MAX_SHOWN);

  if (upcoming.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: 'var(--theme-card)',
        border: '1px solid rgba(197,168,128,0.25)',
      }}
    >
      <div className="flex items-center justify-between">
        <h2
          className="flex items-center gap-2 text-base font-semibold"
          style={{ color: 'var(--theme-text)' }}
        >
          <Calendar size={15} style={{ color: 'var(--theme-primary)' }} />
          {t('events.heading')}
        </h2>
        <Link
          href="/events"
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: 'var(--theme-primary)' }}
        >
          {t('events.all')} <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {upcoming.map((event) => {
          const start = new Date(event.startsAt);
          return (
            <Link
              key={event.id}
              href={`/events#event-${event.id}`}
              className="flex gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
              style={{ border: '1px solid var(--theme-border)' }}
            >
              <div
                className="flex flex-col items-center justify-center rounded-md px-2 py-1 flex-shrink-0"
                style={{ background: 'rgba(197,168,128,0.12)' }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  {formatDate(start, { month: 'short', day: undefined, year: undefined })}
                </span>
                <span className="text-base font-bold leading-none" style={{ color: 'var(--theme-text)' }}>
                  {start.getDate()}
                </span>
              </div>

              <div className="min-w-0">
                <p
                  className="text-xs font-medium truncate flex items-center gap-1"
                  style={{ color: 'var(--theme-text)' }}
                >
                  {event.title}
                  {event.seriesId && (
                    <Repeat size={10} style={{ color: 'var(--theme-text-muted)' }} />
                  )}
                </p>
                <p
                  className="text-[11px] flex items-center gap-1 truncate"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {formatTime(start)}
                  {event.isVirtual ? (
                    <>
                      <Video size={9} /> {t('events.online')}
                    </>
                  ) : event.location ? (
                    <>
                      <MapPin size={9} /> {event.location}
                    </>
                  ) : null}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

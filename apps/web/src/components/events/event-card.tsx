'use client';

import { Calendar, MapPin, Video, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RsvpButton } from './rsvp-button';
import { AddToCalendar } from './add-to-calendar';
import { formatEventDuration, isUpcoming } from '@community/shared';
import type { CommunityEvent } from '@community/shared';

interface EventCardProps {
  event: CommunityEvent;
}

export function EventCard({ event }: EventCardProps) {
  const upcoming = isUpcoming(event.startsAt);
  const rsvpCount = event._count?.rsvps ?? event.rsvps?.length ?? 0;
  const isFull = event.maxRsvps ? rsvpCount >= event.maxRsvps : false;

  return (
    // No overflow-hidden: it clipped the "Add to calendar" popover.
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {event.isVirtual ? (
                <Badge style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.3)', color: '#818cf8' }}>
                  Virtual
                </Badge>
              ) : (
                <Badge style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
                  In-Person
                </Badge>
              )}
              {!upcoming && (
                <Badge variant="secondary" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}>
                  Past
                </Badge>
              )}
              {isFull && upcoming && (
                <Badge style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  Full
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--theme-text)' }}>
              {event.title}
            </h3>
          </div>
        </div>

        {/* Short preview on the dashboard: the text without formatting. */}
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--theme-text-muted)' }}>
          {event.description.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()}
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            <Calendar size={13} style={{ color: 'var(--theme-primary)' }} />
            <span>{formatEventDuration(event.startsAt, event.endsAt)}</span>
          </div>
          {(event.location || event.meetingUrl) && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {event.isVirtual ? <Video size={13} style={{ color: 'var(--theme-primary)' }} /> : <MapPin size={13} style={{ color: 'var(--theme-primary)' }} />}
              <span className="truncate">{event.location || 'Online meeting'}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            <Users size={13} style={{ color: 'var(--theme-primary)' }} />
            <span>
              {rsvpCount} attending
              {event.maxRsvps ? ` · ${event.maxRsvps} max` : ''}
            </span>
          </div>
        </div>

        {upcoming && (
          <div className="flex flex-wrap items-center gap-2">
            <RsvpButton event={event} />
            <AddToCalendar event={event} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

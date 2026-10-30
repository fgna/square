'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, MapPin, Video, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from '@/store/toast.store';
import { defaultEventTimes, followEnd, toLocalInput } from '@/lib/event-times';
import { CategoryPicker } from '@/components/common/category-picker';
import { RichTextEditor } from '@/components/feed/rich-text-editor';
import { RecordingsAdminDialog } from '@/components/events/recordings-admin-dialog';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatDate } from '@community/shared';
import type { CommunityEvent } from '@community/shared';

function useAdminEvents() {
  return useQuery({
    queryKey: ['admin', 'events'],
    // Admins manage past events too (recordings are added afterwards).
    queryFn: () => apiClient.get('/events', { params: { limit: 100, when: 'all' } }).then((r) => r.data),
  });
}

// The API requires full ISO-8601 timestamps, but <input type="datetime-local">
// yields values like "2026-10-01T14:30". Interpret those as local time and send
// the corresponding UTC instant.
function toIsoTimestamp(localValue: string): string | undefined {
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

// Mirrors the server-side CreateEventDto so the form fails before the request
// does, with a message naming the field.
const TITLE_MIN = 3;
const DESCRIPTION_MIN = 10;

function EventDialog({
  event,
  lastMeetingUrl,
  onClose,
}: {
  event: CommunityEvent | null;
  /** Meeting link of the most recently created event, offered for a new one. */
  lastMeetingUrl?: string;
  onClose: () => void;
}) {
  const t = useTranslations('adminEventsUI');
  const queryClient = useQueryClient();
  const editing = !!event;
  // A new event starts at the next full hour and lasts an hour: the browser's
  // picker otherwise proposes the current minute (14:37), which then had to be
  // corrected by hand every time.
  const [defaults] = useState(() => defaultEventTimes());
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState(event ? toLocalInput(new Date(event.startsAt)) : defaults.startsAt);
  const [endsAt, setEndsAt] = useState(event ? toLocalInput(new Date(event.endsAt)) : defaults.endsAt);
  const [location, setLocation] = useState(event?.location ?? '');
  // Most events run in the same video room, so a new one starts with the link
  // of the last event; the admin can change or clear it.
  const [isVirtual, setIsVirtual] = useState(event ? event.isVirtual : !!lastMeetingUrl);
  const [meetingUrl, setMeetingUrl] = useState(event ? (event.meetingUrl ?? '') : (lastMeetingUrl ?? ''));
  const [maxRsvps, setMaxRsvps] = useState(event?.maxRsvps ? String(event.maxRsvps) : '');
  const [remind24h, setRemind24h] = useState(event?.remind24h ?? true);
  const [categoryIds, setCategoryIds] = useState<string[]>((event?.categories ?? []).map((c) => c.category.id));
  const [recurrence, setRecurrence] = useState<string>('NONE');
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The end follows the start (keeping the duration) until the admin sets it.
  const changeStart = (value: string) => {
    setEndsAt((end) => followEnd(startsAt, value, end));
    setStartsAt(value);
  };

  const create = useMutation({
    // Reported inline by the form itself; a toast would say it twice.
    meta: { silent: true },
    mutationFn: () => {
      const common = {
        title: title.trim(),
        description: description.trim(),
        startsAt: toIsoTimestamp(startsAt),
        endsAt: toIsoTimestamp(endsAt),
        location: location.trim() || undefined,
        isVirtual,
        meetingUrl: meetingUrl.trim() || undefined,
        maxRsvps: maxRsvps ? Number(maxRsvps) : undefined,
        remind24h,
        categoryIds,
      };
      if (editing) return apiClient.put(`/events/${event!.id}`, common);
      return apiClient.post('/events', {
        ...common,
        recurrence: recurrence === 'NONE' ? undefined : recurrence,
        recurrenceEndsAt:
          recurrence === 'NONE' || !recurrenceEndsAt
            ? undefined
            : toIsoTimestamp(recurrenceEndsAt),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(editing ? t('updated') : t('created'));
      onClose();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(' · ')
          : message || err?.message || (editing ? t('saveFailed') : t('createFailed')),
      );
    },
  });

  // Checked in the same order the fields appear, so the message points at the
  // first thing the admin needs to change.
  const validationError = (() => {
    if (title.trim().length < TITLE_MIN) {
      return t('titleTooShort', { min: TITLE_MIN });
    }
    // The editor stores HTML; count only the words a member reads.
    if (description.replace(/<[^>]+>/g, '').trim().length < DESCRIPTION_MIN) {
      return t('descriptionTooShort', { min: DESCRIPTION_MIN });
    }
    if (!startsAt || !endsAt) return t('pickTimes');
    if (!toIsoTimestamp(startsAt) || !toIsoTimestamp(endsAt)) {
      return t('invalidTimes');
    }
    if (new Date(startsAt) >= new Date(endsAt)) {
      return t('endBeforeStart');
    }
    if (isVirtual && meetingUrl.trim() && !/^https?:\/\//i.test(meetingUrl.trim())) {
      return t('invalidMeetingUrl');
    }
    if (recurrence !== 'NONE' && recurrenceEndsAt) {
      const end = toIsoTimestamp(recurrenceEndsAt);
      if (!end) return t('invalidRepeatEnd');
      if (new Date(recurrenceEndsAt) < new Date(startsAt)) {
        return t('repeatEndBeforeStart');
      }
    }
    return null;
  })();

  const handleCreate = () => {
    setError(null);
    if (validationError) {
      setError(validationError);
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('edit') : t('new')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--theme-danger, #ef4444)',
              }}
            >
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="e-title">{t('title')}</Label>
            <Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('sampleTitle')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-desc">{t('description')}</Label>
            <div id="e-desc">
              <RichTextEditor content={description} onChange={setDescription} placeholder={t('sampleDesc')} compact />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-start">{t('starts')}</Label>
              <Input id="e-start" type="datetime-local" step={900} value={startsAt} onChange={(e) => changeStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-end">{t('ends')}</Label>
              <Input id="e-end" type="datetime-local" step={900} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-loc">{t('location')}</Label>
            <Input id="e-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('sampleLocation')} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{t('virtual')}</p>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('virtualDesc')}</p>
            </div>
            <Switch checked={isVirtual} onCheckedChange={setIsVirtual} />
          </div>
          {isVirtual && (
            <div className="space-y-1.5">
              <Label htmlFor="e-url">{t('meeting')}</Label>
              <Input id="e-url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.example.com/..." />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="e-max">{t('max')}</Label>
            <Input id="e-max" type="number" min={1} value={maxRsvps} onChange={(e) => setMaxRsvps(e.target.value)} placeholder={t('unlimited')} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{t('remind24h')}</p>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('remind24hDesc')}</p>
            </div>
            <Switch checked={remind24h} onCheckedChange={setRemind24h} />
          </div>
          <CategoryPicker value={categoryIds} onChange={setCategoryIds} />
          {editing ? (
            event!.seriesId && (
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {t('seriesNote')}
              </p>
            )
          ) : (
          <div className="space-y-1.5">
            <Label htmlFor="e-repeat">{t('repeat')}</Label>
            <select
              id="e-repeat"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            >
              <option value="NONE">{t('repeatNone')}</option>
              <option value="DAILY">{t('repeatDaily')}</option>
              <option value="WEEKDAYS">{t('repeatWeekdays')}</option>
              <option value="WEEKLY">{t('repeatWeekly')}</option>
              <option value="BIWEEKLY">{t('repeatBiweekly')}</option>
              <option value="MONTHLY">{t('repeatMonthly')}</option>
            </select>
            {recurrence !== 'NONE' && (
              <>
                <Label htmlFor="e-repeat-end" className="pt-2 block">
                  {t('repeatUntil')}
                </Label>
                <Input
                  id="e-repeat-end"
                  type="datetime-local"
                  value={recurrenceEndsAt}
                  onChange={(e) => setRecurrenceEndsAt(e.target.value)}
                />
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('repeatHint')}
                </p>
              </>
            )}
          </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={create.isPending}
            style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
          >
            {create.isPending ? t('saving') : editing ? t('saveChanges') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminEventsPage() {
  const t = useTranslations('adminEventsUI');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminEvents();
  // null: closed; 'new': creating; an event: editing it.
  const [dialog, setDialog] = useState<CommunityEvent | 'new' | null>(null);
  const [recordingsFor, setRecordingsFor] = useState<CommunityEvent | null>(null);
  const lastMeetingUrl = ((data?.data ?? []) as CommunityEvent[])
    .filter((e) => e.meetingUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.meetingUrl ?? undefined;

  const deleteEvent = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'events'] }),
  });

  const events: CommunityEvent[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      {dialog && (
        <EventDialog
          key={dialog === 'new' ? 'new' : dialog.id}
          event={dialog === 'new' ? null : dialog}
          lastMeetingUrl={lastMeetingUrl}
          onClose={() => setDialog(null)}
        />
      )}
      {recordingsFor && <RecordingsAdminDialog event={recordingsFor} onClose={() => setRecordingsFor(null)} />}
      <div className="flex items-start justify-between">
        <PageHeader title={t('management')} description={t('count', { count: data?.total ?? 0 })} icon={Calendar} />
        <Button
          size="sm"
          style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
          onClick={() => setDialog('new')}
        >
          + {t('new')}
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          : events.map((event) => {
              const isPast = new Date(event.startsAt) < new Date();
              return (
                <div
                  key={event.id}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)', opacity: isPast ? 0.6 : 1 }}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-center"
                    style={{ background: 'rgba(197,168,128,0.1)', border: '1px solid var(--theme-border)' }}>
                    <span className="text-xs font-bold" style={{ color: 'var(--theme-primary)' }}>
                      {new Date(event.startsAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-lg font-bold" style={{ color: 'var(--theme-text)' }}>
                      {new Date(event.startsAt).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm" style={{ color: 'var(--theme-text)' }}>{event.title}</p>
                      {isPast && <Badge variant="secondary" className="text-xs">{t('past')}</Badge>}
                      {event.isVirtual && (
                        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-xs">
                          <Video size={10} className="mr-1" />{t('virtualBadge')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      <span>{formatDate(event.startsAt)}</span>
                      {event.location && (
                        <span className="flex items-center gap-1"><MapPin size={10} />{event.location}</span>
                      )}
                      <span>{t('rsvps', { count: event._count?.rsvps ?? 0 })}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setRecordingsFor(event)}>
                    {t('recordings')}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setDialog(event)}>
                    {t('editShort')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-red-400 hover:text-red-300"
                    onClick={() => {
                      if (confirm(t('deleteConfirm', { name: event.title }))) deleteEvent.mutate(event.id);
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              );
            })}
      </div>
    </div>
  );
}

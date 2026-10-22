'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bell, Check, Heart, MessageCircle, Smile, Calendar, Mail, UsersRound } from 'lucide-react';
import { formatDistanceToNow, type Locale as DateFnsLocale } from 'date-fns';
import { useFormatters } from '@/lib/use-formatters';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUnreadCount, useNotifications, useMarkAllRead, useMarkRead } from '@/hooks/use-notifications';
import { getInitials } from '@community/shared';
import type { Notification, NotificationType } from '@community/shared';

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  REACTION: <Heart size={12} className="text-pink-400" />,
  COMMENT: <MessageCircle size={12} className="text-blue-400" />,
  MENTION: <Smile size={12} className="text-yellow-400" />,
  EVENT_REMINDER: <Calendar size={12} className="text-green-400" />,
  MESSAGE: <Mail size={12} className="text-purple-400" />,
  GROUP_INVITE: <UsersRound size={12} className="text-amber-400" />,
};

type Translate = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};

/**
 * The sentence a notification reads as. Event reminders have no actor, so
 * "<actor> <label>" came out as "Someone Event reminder"; they name the
 * event instead.
 */
export function describeNotification(
  notification: Notification,
  t: Translate,
  dateLocale?: DateFnsLocale,
): { who: string | null; what: string } {
  if (notification.type === 'EVENT_REMINDER') {
    const event = notification.event;
    if (!event) return { who: null, what: t('reminderUnknown') };
    const startsAt = new Date(event.startsAt);
    const when = formatDistanceToNow(startsAt, { addSuffix: true, locale: dateLocale });
    const key = startsAt.getTime() < Date.now() ? 'reminderStarted' : 'reminderStarts';
    return { who: null, what: t(key, { title: event.title, when }) };
  }
  return { who: notification.actor?.name ?? t('someone'), what: t.has(`types.${notification.type}`) ? t(`types.${notification.type}`) : t('unknownType') };
}

function NotificationRow({ notification }: { notification: Notification }) {
  const t = useTranslations('notifications');
  const { dateFnsLocale } = useFormatters();
  const markRead = useMarkRead();
  const router = useRouter();
  const { who, what } = describeNotification(notification, t, dateFnsLocale);
  const eventId = notification.event?.id;
  const conversationId = notification.type === 'MESSAGE' ? notification.entityId : null;

  return (
    <button
      className="flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-white/5"
      style={{
        background: notification.read ? 'transparent' : 'rgba(197,168,128,0.04)',
        borderBottom: '1px solid var(--theme-border)',
      }}
      onClick={() => {
        if (!notification.read) markRead.mutate(notification.id);
        if (eventId) router.push(`/events#event-${eventId}`);
        else if (conversationId) router.push(`/messages?conv=${conversationId}`);
        else if (notification.type === 'GROUP_INVITE') router.push('/learning-groups');
      }}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={notification.actor?.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {who ? getInitials(who) : <Calendar size={14} />}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
          {TYPE_ICONS[notification.type]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-snug" style={{ color: 'var(--theme-text)' }}>
          {who && <span className="font-medium">{who} </span>}
          {what}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: dateFnsLocale })}
        </p>
      </div>
      {!notification.read && (
        <span className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ background: 'var(--theme-primary)' }} />
      )}
    </button>
  );
}

export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const { data: countData } = useUnreadCount();
  const { data: notifications, refetch, isFetching } = useNotifications(1);
  const markAllRead = useMarkAllRead();

  const count = countData?.count ?? 0;
  const items = notifications?.data ?? [];

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The count polls every 30 s but the list is cached for 5 min, so the
        // badge could say 4 over a list saying "No notifications yet".
        if (next) refetch();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-white/5"
          aria-label={t('title')}
        >
          <Bell size={18} style={{ color: 'var(--theme-text-muted)' }} />
          {count > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold px-0.5"
              style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0 overflow-hidden"
        style={{
          background: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
            {t('title')} {count > 0 && <span style={{ color: 'var(--theme-primary)' }}>({count})</span>}
          </span>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs flex items-center gap-1"
              style={{ color: 'var(--theme-text-muted)' }}
              onClick={() => markAllRead.mutate()}
            >
              <Check size={12} /> {t('markAllRead')}
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && isFetching ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto mb-2" style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }} />
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('empty')}</p>
            </div>
          ) : (
            items.map((n) => <NotificationRow key={n.id} notification={n} />)
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

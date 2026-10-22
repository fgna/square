import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Notification } from '@community/shared';
import { useTranslations } from 'next-intl';
import { describeNotification } from './notification-bell';

// Resolved against en.json by the next-intl mock in test-setup.ts.
const t = useTranslations('notifications');

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: 'n1',
    userId: 'u1',
    actorId: null,
    actor: null,
    type: 'EVENT_REMINDER',
    entityId: 'ev1',
    entityType: 'event',
    read: false,
    createdAt: '2026-09-21T08:00:00.000Z',
    ...overrides,
  };
}

describe('describeNotification', () => {
  afterEach(() => vi.useRealTimers());

  it('names the event in a reminder instead of "Someone Event reminder"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T08:00:00Z'));

    const text = describeNotification(
      notification({ event: { id: 'ev1', title: 'Journaling', startsAt: '2026-09-22T08:00:00Z' } }),
      t,
    );

    expect(text.who).toBeNull();
    expect(text.what).toBe('Reminder: Journaling starts in 1 day');
  });

  it('says "started" once the event has begun', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T10:00:00Z'));

    const text = describeNotification(
      notification({ event: { id: 'ev1', title: 'Journaling', startsAt: '2026-09-22T08:00:00Z' } }),
      t,
    );

    expect(text.what).toBe('Reminder: Journaling started about 2 hours ago');
  });

  it('still reads sensibly when the event has been deleted', () => {
    expect(describeNotification(notification({ event: null }), t).what).toBe(
      'Reminder: an event you signed up for',
    );
  });

  it('uses a neutral fallback for a newly introduced notification type', () => {
    const text = describeNotification(
      notification({ type: 'UNRECOGNIZED_TYPE' as Notification['type'], actor: { id: 'u2', name: 'Alice Johnson' } }),
      t,
    );
    expect(text).toEqual({ who: 'Alice Johnson', what: 'sent a notification' });
  });

  it('keeps "<actor> <action>" for everything else', () => {
    const text = describeNotification(
      notification({ type: 'COMMENT', actor: { id: 'u2', name: 'Alice Johnson' }, entityType: 'post' }),
      t,
    );

    expect(text).toEqual({ who: 'Alice Johnson', what: 'commented on your post' });
  });
});

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CalendarPlus, Download, ExternalLink, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadEventIcs, googleCalendarUrl } from '@/lib/ics';
import type { CommunityEvent } from '@community/shared';

/**
 * Sits next to the RSVP button, because that is the moment the question comes
 * up. The options open as a popover so the button can stay in the same row
 * instead of pushing the card layout around.
 *
 * A downloaded file — or a Google "create event" link — is a copy: if the
 * event is later cancelled, nothing removes it again. Only the subscription
 * does that, which is why it is named here rather than left in Settings.
 *
 * The popover is portalled to <body> with fixed positioning. Rendered inside
 * the card it could never overlap the next card: each Card has a
 * backdrop-filter, which makes it its own stacking context, so the popover
 * disappeared behind the event below whatever its z-index.
 */

// Enough for the popover's content; below this much room it opens upwards.
const POPOVER_HEIGHT = 260;

type PopoverPosition = { right: number } & ({ top: number } | { bottom: number });

export function popoverPosition(
  button: { top: number; bottom: number; right: number },
  viewport: { width: number; height: number },
): PopoverPosition {
  const right = viewport.width - button.right;
  const roomBelow = viewport.height - button.bottom;
  if (roomBelow < POPOVER_HEIGHT && button.top > roomBelow) {
    return { right, bottom: viewport.height - button.top + 6 };
  }
  return { right, top: button.bottom + 6 };
}
export function AddToCalendar({ event }: { event: CommunityEvent }) {
  const t = useTranslations('events');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition(popoverPosition(rect, { width: window.innerWidth, height: window.innerHeight }));
    }
    setOpen(true);
  };
  const isRecurring = Boolean(event.seriesId);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!wrapperRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // A fixed popover would drift away from its button while the page moves.
    const close = () => setOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={toggle}
        title={t('calendarMenu.tooltip')}
      >
        <CalendarPlus size={14} className="mr-1.5" />
        {t('calendarMenu.button')}
      </Button>

      {open && position && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('calendarMenu.button')}
          className="fixed z-50 w-72 rounded-lg p-3 space-y-2.5 shadow-lg"
          style={{
            ...position,
            // Same surface as the notification dropdown: --theme-card is
            // translucent and would let the page show through.
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* The subscription comes first: it is the only way that also
              removes the event again when the RSVP is withdrawn or the event
              is cancelled. */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold" style={{ color: 'var(--theme-text)' }}>
              {isRecurring && <Repeat size={12} className="inline mr-1 -mt-0.5" />}
              {t('calendarMenu.recommended')}
            </p>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {t('calendarMenu.recommendedText')}
            </p>
            <Button asChild size="sm" className="w-full">
              <Link href="/settings#calendar-feed" onClick={() => setOpen(false)}>
                <Repeat size={14} className="mr-1.5" />
                {t('calendarMenu.subscribe')}
              </Link>
            </Button>
          </div>

          <div className="space-y-1.5 pt-2" style={{ borderTop: '1px solid var(--theme-border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--theme-text)' }}>
              {t('calendarMenu.copy')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  downloadEventIcs(event);
                  setOpen(false);
                }}
              >
                <Download size={14} className="mr-1.5" />
                {t('calendarMenu.download')}
              </Button>
              <Button asChild size="sm" variant="outline">
                <a
                  href={googleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink size={14} className="mr-1.5" />
                  Google
                </a>
              </Button>
            </div>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {t('calendarMenu.copyNote')}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { renderPostContent } from '@/lib/render-post-content';

/**
 * An event description: plain text (older events) or editor HTML with links,
 * sanitised like posts. Long ones open with "Mehr anzeigen", so links further
 * down are reachable. The button only appears when three lines really cut
 * text off (measured, so it follows the card's width); otherwise it did
 * nothing when clicked.
 */
export function EventDescription({ text, className = '' }: { text: string; className?: string }) {
  const t = useTranslations('events');
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const rendered = renderPostContent(text);

  useEffect(() => {
    const el = box.current;
    if (!el || open) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rendered.html, open]);

  return (
    <div className={className}>
      <div
        ref={box}
        className={`text-sm leading-relaxed ${rendered.className} ${!open ? 'line-clamp-3' : ''}`}
        style={{ color: 'var(--theme-text-muted)' }}
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
      {(clipped || open) && (
        <button type="button" className="text-xs underline mt-1" style={{ color: 'var(--theme-text-muted)' }} onClick={() => setOpen(!open)}>
          {open ? t('showLess') : t('showMore')}
        </button>
      )}
    </div>
  );
}

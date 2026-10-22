'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { renderPostContent } from '@/lib/render-post-content';

/**
 * An event description: plain text (older events) or editor HTML with links,
 * sanitised like posts. Long ones open with "Mehr anzeigen", so links further
 * down are reachable.
 */
export function EventDescription({ text, className = '' }: { text: string; className?: string }) {
  const t = useTranslations('events');
  const [open, setOpen] = useState(false);
  const rendered = renderPostContent(text);
  const long = text.replace(/<[^>]+>/g, '').length > 180;

  return (
    <div className={className}>
      <div
        className={`text-sm leading-relaxed ${rendered.className} ${long && !open ? 'line-clamp-3' : ''}`}
        style={{ color: 'var(--theme-text-muted)' }}
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
      {long && (
        <button type="button" className="text-xs underline mt-1" style={{ color: 'var(--theme-text-muted)' }} onClick={() => setOpen(!open)}>
          {open ? t('showLess') : t('showMore')}
        </button>
      )}
    </div>
  );
}

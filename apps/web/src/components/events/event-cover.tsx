'use client';

import { useTranslations } from 'next-intl';

/**
 * The cover picture of an event. A photo from Unsplash carries the
 * photographer credit their guidelines require.
 */
export function EventCover({
  url,
  credit,
  title,
}: {
  url?: string | null;
  credit?: { name: string; url: string; source?: string } | null;
  title: string;
}) {
  const t = useTranslations('events');
  if (!url) return null;
  return (
    <figure className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- uploads and Unsplash URLs, sized by CSS */}
      <img src={url} alt={title} className="block w-full object-cover rounded-t-xl" style={{ aspectRatio: '3 / 1' }} loading="lazy" />
      {credit && (
        <figcaption className="absolute bottom-1 right-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
          {t.rich('coverCredit', {
            name: credit.name,
            author: (chunks) => <a href={credit.url} target="_blank" rel="noopener noreferrer" className="underline">{chunks}</a>,
            library: (chunks) => <a href={`https://unsplash.com/?${credit.url.split('?')[1] ?? ''}`} target="_blank" rel="noopener noreferrer" className="underline">{chunks}</a>,
          })}
        </figcaption>
      )}
    </figure>
  );
}

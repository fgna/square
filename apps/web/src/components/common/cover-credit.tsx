'use client';

import { useTranslations } from 'next-intl';

export type PhotoCredit = { name: string; url: string; source?: string };

/**
 * "Photo: <name> on Unsplash", the credit Unsplash's guidelines require for a
 * hotlinked photo. Inside a link (a course card) the names stay plain text,
 * since links cannot be nested.
 */
export function CoverCredit({ credit, links = true }: { credit: PhotoCredit; links?: boolean }) {
  const t = useTranslations('events');
  return (
    <figcaption className="absolute bottom-1 right-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
      {t.rich('coverCredit', {
        name: credit.name,
        author: (chunks) => (links ? <a href={credit.url} target="_blank" rel="noopener noreferrer" className="underline">{chunks}</a> : <>{chunks}</>),
        library: (chunks) => (links ? <a href={`https://unsplash.com/?${credit.url.split('?')[1] ?? ''}`} target="_blank" rel="noopener noreferrer" className="underline">{chunks}</a> : <>{chunks}</>),
      })}
    </figcaption>
  );
}

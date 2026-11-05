'use client';

import { CoverCredit } from '@/components/common/cover-credit';

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
  if (!url) return null;
  return (
    <figure className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- uploads and Unsplash URLs, sized by CSS */}
      <img src={url} alt={title} className="block w-full object-cover rounded-t-xl" style={{ aspectRatio: '3 / 1' }} loading="lazy" />
      {credit && <CoverCredit credit={credit} />}
    </figure>
  );
}

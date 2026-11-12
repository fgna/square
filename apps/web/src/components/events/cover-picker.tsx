'use client';

import { useTranslations } from 'next-intl';
import { ImageUploadField } from '@/components/common/image-upload-field';
import { UnsplashSearch, useUnsplashEnabled } from '@/components/common/unsplash-search';

export type CoverCredit = { name: string; url: string; source?: string } | null;

/**
 * Admins give an event, a course or a digest a cover: an uploaded picture, or
 * a photo from Unsplash when the operator configured it (UNSPLASH_ACCESS_KEY).
 * `api` is the owner's photo search ("/events/covers", "/courses/covers" …).
 */
export function CoverPicker({
  url,
  onChange,
  api = '/events/covers',
}: {
  url: string | null;
  onChange: (url: string | null, credit: CoverCredit) => void;
  api?: string;
}) {
  const t = useTranslations('adminEventsUI');
  const unsplash = useUnsplashEnabled(api);
  return (
    <div className="space-y-2">
      <ImageUploadField label={t('cover')} value={url} onChange={(next) => onChange(next, null)} />
      {unsplash && <UnsplashSearch api={api} onChoose={(photo) => onChange(photo.url, photo.credit)} />}
    </div>
  );
}

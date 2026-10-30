'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { androidAppDownloadUrl } from '@community/shared';
import { useBranding } from '@/hooks/use-branding';

/** Same public setting on landing, plugin sign-in and member pages. */
export function AndroidAppLink({ className = '' }: { className?: string }) {
  const { data: branding } = useBranding();
  const t = useTranslations('getAppUI');
  if (!androidAppDownloadUrl(branding)) return null;
  return (
    <div className={`text-center text-sm ${className}`}>
      <Link href="/get-app" className="underline underline-offset-4" style={{ color: 'var(--theme-primary)' }}>
        {t('download')}
      </Link>
    </div>
  );
}

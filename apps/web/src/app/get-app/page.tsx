'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Smartphone, Download, CheckCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import { useBranding } from '@/hooks/use-branding';
import { androidAppDownloadUrl } from '@community/shared';
import { Button } from '@/components/ui/button';

const featureItems = [
  { icon: Shield, key: 'featureHttps' },
  { icon: CheckCircle, key: 'featureContent' },
] as const;

export default function GetAppPage() {
  const t = useTranslations('getAppUI');
  const { data: branding, isLoading } = useBranding();
  const downloadUrl = androidAppDownloadUrl(branding);
  const [communityUrl, setCommunityUrl] = useState('');
  useEffect(() => { setCommunityUrl(window.location.origin); }, []);
  return (
    <main className="max-w-lg mx-auto py-12 px-4 space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <div
          className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(197,168,128,0.1)' }}
        >
          <Smartphone size={36} style={{ color: 'var(--theme-primary)' }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>
          {t('title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      <div
        className="rounded-xl p-6 space-y-4"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        {featureItems.map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(197,168,128,0.08)' }}
            >
              <f.icon size={16} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <span className="text-sm" style={{ color: 'var(--theme-text)' }}>
              {t(f.key)}
            </span>
          </div>
        ))}
      </div>

      <div className="text-center space-y-3">
        {downloadUrl ? <Button asChild size="lg" className="gap-2 w-full sm:w-auto">
          <a href={downloadUrl} referrerPolicy="no-referrer">
            <Download size={16} />
            {t('download')}
          </a>
        </Button> : <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>{isLoading ? t('loading') : t('unavailable')}</p>}
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {t('requirement')}
        </p>
      </div>

      {downloadUrl && <div
        className="rounded-xl p-5 space-y-3"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {t('steps')}
        </h2>
        <ol className="space-y-2 text-sm list-decimal list-inside" style={{ color: 'var(--theme-text-muted)' }}>
          <li>{t('stepDownload')}</li>
          <li>{t('stepOpen')}</li>
          <li>{t('stepAllow')}</li>
          <li>{t('stepInstall')}</li>
          <li>{t('stepServer', { url: communityUrl })}</li>
          <li>{t('stepSignIn')}</li>
        </ol>
      </div>}
      <p className="text-xs text-center" style={{ color: 'var(--theme-text-muted)' }}>{t('offline')}</p>
      <p className="text-center text-sm"><Link href="/" className="underline">{t('back')}</Link></p>
    </main>
  );
}

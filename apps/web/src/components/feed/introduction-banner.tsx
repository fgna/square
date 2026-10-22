'use client';

import { useTranslations } from 'next-intl';
import { Hand, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IntroductionBannerProps {
  onIntroduce: () => void;
  onDismiss: () => void;
}

export function IntroductionBanner({ onIntroduce, onDismiss }: IntroductionBannerProps) {
  const t = useTranslations('feed');
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3 animate-fade-in"
      style={{
        background: 'rgba(34, 197, 94, 0.06)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(34, 197, 94, 0.12)' }}
      >
        <Hand size={18} style={{ color: '#22c55e' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {t('intro.title')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
          {t('intro.text')}
        </p>
        <Button size="sm" className="mt-2.5 text-xs h-7" onClick={onIntroduce}>
          <Hand size={12} className="mr-1.5" />
          {t('intro.button')}
        </Button>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded-md hover:bg-white/5 flex-shrink-0"
        aria-label={t('intro.dismiss')}
      >
        <X size={14} style={{ color: 'var(--theme-text-muted)' }} />
      </button>
    </div>
  );
}

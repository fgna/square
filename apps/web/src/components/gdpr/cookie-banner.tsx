'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIVACY_URL } from '@/lib/legal';

const SEEN_KEY = 'privacy-notice-seen';


/**
 * A notice, not a consent dialog. The platform stores only what it needs to
 * work (sign-in, language, display), which needs no consent (§ 25 Abs. 2
 * TDDDG). It used to ask for "analytics" and "marketing" consent although no
 * such tools exist — that promised something the platform does not do.
 */
export function CookieBanner() {
  const t = useTranslations('privacyNotice');
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage blocked: the notice simply shows again next time.
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={t('title')}
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 rounded-xl p-4 shadow-2xl animate-fade-in"
      style={{
        background: 'var(--theme-surface)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--theme-border)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {t('title')}
        </p>
        <button onClick={close} className="flex-shrink-0" aria-label={t('close')}>
          <X size={16} style={{ color: 'var(--theme-text-muted)' }} />
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--theme-text-muted)' }}>
        {t('text')}{' '}
        {PRIVACY_URL && (
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--theme-primary)' }}>
            {t('link')}
          </a>
        )}
      </p>
      <Button size="sm" className="w-full text-xs" onClick={close}>
        {t('ok')}
      </Button>
    </div>
  );
}

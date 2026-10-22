'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
};

const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
};

function getCurrentLocale(): Locale {
  // Without a cookie the server renders the default language; the switcher
  // has to show the same, or it marks English while the page is German.
  if (typeof document === 'undefined') return defaultLocale;
  const match = document.cookie.match(/NEXT_LOCALE=(\w+)/);
  return (match?.[1] as Locale) || defaultLocale;
}

export function LocaleSwitcher() {
  const t = useTranslations('settings.language');
  const router = useRouter();
  const current = getCurrentLocale();

  const switchLocale = (locale: Locale) => {
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  };

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
    >
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--theme-text)' }}>
        {t('title')}
      </h3>
      <p className="text-sm mb-4" style={{ color: 'var(--theme-text-muted)' }}>
        {t('subtitle')}
      </p>
      <div className="flex gap-3">
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => switchLocale(locale)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: current === locale ? 'rgba(197,168,128,0.15)' : 'rgba(255,255,255,0.03)',
              border: current === locale ? '1px solid rgba(197,168,128,0.3)' : '1px solid var(--theme-border)',
              color: current === locale ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
            }}
          >
            <span className="text-lg">{LOCALE_FLAGS[locale]}</span>
            {LOCALE_LABELS[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}

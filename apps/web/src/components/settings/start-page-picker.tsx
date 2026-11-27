'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HOME_PATH } from '@/plugins/home.generated';
import { forgetLastPage, readStartPageCookie, saveStartPage, startPageChoice, type StartPage } from '@/lib/start-page';

const OPTIONS: StartPage[] = ['last', 'home'];

/** Where this device opens the app: the last page (within 24 hours) or the start page. */
export function StartPagePicker() {
  const t = useTranslations('settings.startPage');
  // The server cannot see this device's cookie; show the instance's choice until mounted.
  const [choice, setChoice] = useState<StartPage>(() => startPageChoice(undefined));
  useEffect(() => setChoice(startPageChoice(readStartPageCookie())), []);

  const choose = (next: StartPage) => {
    saveStartPage(next);
    if (next === 'home') forgetLastPage();
    setChoice(next);
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
      <div className="flex flex-col sm:flex-row gap-3" role="radiogroup" aria-label={t('title')}>
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choice === option}
            onClick={() => choose(option)}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-all"
            style={{
              background: choice === option ? 'rgba(197,168,128,0.15)' : 'rgba(255,255,255,0.03)',
              border: choice === option ? '1px solid rgba(197,168,128,0.3)' : '1px solid var(--theme-border)',
              color: choice === option ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
            }}
          >
            {t(option === 'home' && HOME_PATH === '/dashboard' ? 'dashboard' : option)}
          </button>
        ))}
      </div>
    </div>
  );
}

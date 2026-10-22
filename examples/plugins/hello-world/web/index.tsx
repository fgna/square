'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PluginPageProps, WebPlugin } from '@community/plugin-sdk/web';

function HelloWorldPage({ api }: PluginPageProps) {
  const t = useTranslations('plugin.hello-world');
  const [state, setState] = useState<{ name?: string; failed?: boolean }>({});

  useEffect(() => {
    let active = true;
    api
      .get<{ name: string }>('greeting')
      .then(({ name }) => active && setState({ name }))
      .catch(() => active && setState({ failed: true }));
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h1>
      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('intro')}</p>
      {state.failed ? (
        <p role="alert" className="text-sm text-red-400">{t('error')}</p>
      ) : (
        <p className="text-lg" style={{ color: 'var(--theme-text)' }}>
          {state.name ? t('greeting', { name: state.name }) : t('loading')}
        </p>
      )}
    </div>
  );
}

const helloWorld: WebPlugin = { Page: HelloWorldPage };
export default helloWorld;

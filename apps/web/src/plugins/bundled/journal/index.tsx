'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import type { WebPlugin } from '@community/plugin-sdk/web';
import apiClient from '@/lib/api-client';
import { JournalPage } from './journal-page';
import { PackJournalPage, type JournalMethod } from './pack-journal-page';

/**
 * Built-in journal plugin (/p/journal). With a content pack the form follows
 * the pack's method; without one it is the Core's fixed daily form.
 */
function Journal() {
  const t = useTranslations('journal');
  const locale = useLocale();
  const method = useQuery({
    queryKey: ['journal-method', locale],
    queryFn: async () => (await apiClient.get<JournalMethod>('/p/journal/method', { params: { locale } })).data,
    retry: false,
  });
  // Never fall back to the protected legacy form on unknown/failed pack configuration.
  if (method.isPending) return <p role="status">{t('methodConfigLoading')}</p>;
  if (method.isError || !method.data) return <p role="alert">{t('methodConfigError')}</p>;
  return method.data.source === 'pack'
    ? <PackJournalPage method={method.data} />
    : <JournalPage />;
}

const journal: WebPlugin = { Page: Journal };
export default journal;

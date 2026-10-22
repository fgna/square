import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';
import { loadInstanceMessages } from './instance-messages';
import { withPluginMessages } from '@/plugins/messages';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale = raw && locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;
  return { locale, messages: withPluginMessages(await loadInstanceMessages(locale), locale) };
});

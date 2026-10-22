import type { Locale } from '@/i18n/config';
import pluginMessages from './messages.generated.json';

/** Adds the plugins' texts under "plugin"; Core texts cannot be overridden. */
export function withPluginMessages<T extends object>(messages: T, locale: Locale) {
  return { ...messages, plugin: pluginMessages[locale] };
}

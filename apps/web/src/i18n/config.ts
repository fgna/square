export const locales = ['en', 'de'] as const;
export type Locale = (typeof locales)[number];
// The community starts in German; members can switch to English in the settings.
export const defaultLocale: Locale = 'de';

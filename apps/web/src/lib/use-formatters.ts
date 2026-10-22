'use client';

import { useLocale } from 'next-intl';
import { de, enUS } from 'date-fns/locale';
import {
  formatDate as baseFormatDate,
  formatDateTime as baseFormatDateTime,
  formatEventDuration as baseFormatEventDuration,
  formatTime as baseFormatTime,
  timeAgo as baseTimeAgo,
} from '@community/shared';

/**
 * Date and time formatters in the member's language. The shared helpers
 * used to be English only ("1h ago", "SEP 23", "07:45 PM") even in the
 * German interface.
 */
export function useFormatters() {
  const locale = useLocale();
  return {
    locale,
    /** For date-fns: format(date, pattern, { locale: dateFnsLocale }) */
    dateFnsLocale: locale === 'de' ? de : enUS,
    timeAgo: (date: string | Date) => baseTimeAgo(date, locale),
    formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => baseFormatDate(date, options, locale),
    formatDateTime: (date: string | Date) => baseFormatDateTime(date, locale),
    formatTime: (date: string | Date) => baseFormatTime(date, locale),
    formatEventDuration: (start: string | Date, end: string | Date) => baseFormatEventDuration(start, end, locale),
  };
}

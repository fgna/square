export interface DigestSchedule {
  daily: { hour: number; minute: number };
  weekly: { day: number; hour: number; minute: number };
  timeZone: string;
}

export const clock = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

type Translate = (key: string, values?: Record<string, string>) => string;

/**
 * The line under a digest option, with the time the platform really sends it
 * (DIGEST_DAILY_TIME / DIGEST_WEEKLY); without the schedule, no time at all
 * rather than a wrong one. `t` is scoped to settings.notifications.
 */
export function digestOptionDescription(key: 'daily' | 'weekly' | 'off', schedule: DigestSchedule | undefined, t: Translate): string {
  if (key === 'off') return t('offDesc');
  if (!schedule) return t(`${key}DescPlain`);
  if (key === 'daily') return t('dailyDesc', { time: clock(schedule.daily.hour, schedule.daily.minute) });
  return t('weeklyDesc', {
    day: t(`weekday${schedule.weekly.day}`),
    time: clock(schedule.weekly.hour, schedule.weekly.minute),
  });
}

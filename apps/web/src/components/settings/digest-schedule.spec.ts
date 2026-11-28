import { describe, it, expect } from 'vitest';
import { createTranslator } from 'next-intl';
import de from '../../../messages/de.json';
import en from '../../../messages/en.json';
import { digestOptionDescription, type DigestSchedule } from './digest-schedule';

const schedule: DigestSchedule = { daily: { hour: 7, minute: 5 }, weekly: { day: 5, hour: 15, minute: 30 }, timeZone: 'Europe/Berlin' };
const tDe = createTranslator({ locale: 'de', messages: de, namespace: 'settings.notifications' }) as never;
const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'settings.notifications' }) as never;

describe('digest option description', () => {
  it('names the configured weekday and time', () => {
    expect(digestOptionDescription('weekly', schedule, tDe)).toBe('Jeden Freitag um 15:30 Uhr eine Zusammenfassung erhalten');
    expect(digestOptionDescription('weekly', schedule, tEn)).toBe('Receive a summary every Friday at 15:30');
    expect(digestOptionDescription('daily', schedule, tDe)).toBe('Jeden Tag um 07:05 Uhr eine Zusammenfassung erhalten');
  });

  it('says no time rather than a wrong one before the schedule is loaded', () => {
    expect(digestOptionDescription('weekly', undefined, tDe)).toBe('Einmal pro Woche eine Zusammenfassung erhalten');
    expect(digestOptionDescription('daily', undefined, tEn)).toBe('Receive a summary every day');
    expect(digestOptionDescription('off', undefined, tDe)).toBe(de.settings.notifications.offDesc);
  });
});

import { describe, it, expect } from 'vitest';
import type { CommunityEvent } from '@community/shared';
import { buildEventIcs, calendarDescription, googleCalendarUrl } from './ics';

const event = {
  id: 'e1',
  title: 'Durchstarten',
  description: '<p>Live Journaling&nbsp;unter Anleitung</p><p>Fragen &amp; Antworten</p>',
  isVirtual: true,
  meetingUrl: 'https://zoom.us/j/123',
  location: null,
  startsAt: '2026-11-02T06:45:00.000Z',
  endsAt: '2026-11-02T07:30:00.000Z',
} as unknown as CommunityEvent;

describe('calendar entries', () => {
  it('start with the online room and carry text instead of HTML', () => {
    expect(calendarDescription(event)).toBe('Online: https://zoom.us/j/123\n\nLive Journaling unter Anleitung\nFragen & Antworten');
    expect(buildEventIcs(event, 'https://c.example')).toContain('DESCRIPTION:Online: https://zoom.us/j/123\\n\\nLive Journaling');
    expect(new URL(googleCalendarUrl(event)).searchParams.get('details')).toMatch(/^Online: https:\/\/zoom\.us\/j\/123\n/);
  });

  it('keep events on site without an online line', () => {
    expect(calendarDescription({ ...event, isVirtual: false, location: 'Berlin' } as CommunityEvent)).toBe('Live Journaling unter Anleitung\nFragen & Antworten');
  });
});

import { describe, it, expect } from 'vitest';
import { digestDue, digestSchedule, renderDigest, type DigestContent } from './digest-render';

const content: DigestContent = {
  userName: 'Alex',
  platformName: 'Community',
  frequency: 'WEEKLY',
  appUrl: 'https://example.test',
  newPosts: 2,
  topPosts: [{ authorName: 'Sam', snippet: 'Hello <b>there</b>', reactions: 1, comments: 0 }],
  upcomingEvents: [{ title: 'Workshop', startsAt: new Date('2026-10-30T14:00:00Z') }],
  upcomingEventCount: 7,
  newCourses: [],
  unreadNotifications: 3,
};

describe('renderDigest', () => {
  it("uses the admin's template: subject, logo, colour, introduction, sections and closing text", () => {
    const { subject, html } = renderDigest(
      {
        subject: 'Deine Woche',
        headerHtml: 'Diese Woche geht es um Fokus.\n\nBis Freitag!',
        footerHtml: 'Herzlich, dein Team',
        sections: ['upcoming_events'],
        accentColor: '#123456',
        logoUrl: 'https://example.test/logo.png',
      },
      content,
    );
    expect(subject).toBe('Deine Woche');
    expect(html).toContain('src="https://example.test/logo.png"');
    expect(html).toContain('#123456');
    expect(html).toContain('Diese Woche geht es um Fokus.</p>');
    expect(html).toContain('Bis Freitag!');
    expect(html).toContain('Herzlich, dein Team');
    expect(html).toContain('Anstehende Veranstaltungen (7)');
    expect(html).not.toContain('Neue Beiträge');
    // Members can always change or stop the digest.
    expect(html).toContain('https://example.test/settings');
  });

  it('escapes what admins and members wrote', () => {
    const { html } = renderDigest({ headerHtml: '<script>x</script>', sections: ['new_posts'] }, content);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Hello &lt;b&gt;there&lt;/b&gt;');
  });

  it('falls back to a default look without an active template', () => {
    const { subject, html } = renderDigest(null, content);
    expect(subject).toBe('Community: deine Wochenzusammenfassung');
    expect(html).toContain('Neue Beiträge (2)');
    expect(html).toContain('Anstehende Veranstaltungen');
  });
});

describe('digest schedule', () => {
  const schedule = digestSchedule({ DIGEST_WEEKLY: 'fri 15:00', DIGEST_DAILY_TIME: '07:30', PLATFORM_TIME_ZONE: 'Europe/Berlin' });

  it('reads day and times from the environment', () => {
    expect(schedule.weekly).toEqual({ day: 5, hour: 15, minute: 0 });
    expect(schedule.daily).toEqual({ hour: 7, minute: 30 });
  });

  it('is due in the 15 minutes from the local time, also across daylight saving', () => {
    // Friday 30.10.2026 15:05 in Berlin = 14:05 UTC (winter time).
    expect(digestDue('WEEKLY', new Date('2026-10-30T14:05:00Z'), schedule)).toBe(true);
    expect(digestDue('WEEKLY', new Date('2026-10-30T14:20:00Z'), schedule)).toBe(false);
    expect(digestDue('WEEKLY', new Date('2026-10-29T14:05:00Z'), schedule)).toBe(false);
    // Friday 23.10.2026 15:00 in Berlin = 13:00 UTC (summer time).
    expect(digestDue('WEEKLY', new Date('2026-10-23T13:00:00Z'), schedule)).toBe(true);
    expect(digestDue('DAILY', new Date('2026-10-27T06:31:00Z'), schedule)).toBe(true);
  });

  it('keeps the former times by default', () => {
    expect(digestSchedule({})).toMatchObject({ daily: { hour: 8, minute: 0 }, weekly: { day: 1, hour: 8, minute: 0 } });
  });
});

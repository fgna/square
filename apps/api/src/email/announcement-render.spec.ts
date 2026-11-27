import { describe, it, expect } from 'vitest';
import { announcementText, renderAnnouncement } from './announcement-render';

const base = {
  platformName: 'GrowthLeaders',
  appUrl: 'https://community.example.test',
  userName: 'Dr. Anna Beispiel',
  authorName: 'Peter',
  postId: 'p1',
  attachmentTypes: [] as string[],
};

describe('announcement e-mail', () => {
  it('uses the first line as headline and the rest as excerpt', () => {
    expect(announcementText('<p>Monday Motivator</p><p>Heute: <strong>Wachstum</strong>.</p>')).toEqual({
      headline: 'Monday Motivator',
      excerpt: 'Heute: Wachstum.',
    });
  });

  it('shortens long text at a word', () => {
    const { excerpt } = announcementText(`Titel\n${'Wort '.repeat(100)}`);
    expect(excerpt.length).toBeLessThanOrEqual(282);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('greets by first name, links to the post and to the settings', () => {
    const { subject, html } = renderAnnouncement({ ...base, content: 'Hallo zusammen\nNeues Format ab Montag' });
    expect(subject).toBe('GrowthLeaders: Hallo zusammen');
    expect(html).toContain('Hallo Anna,');
    expect(html).toContain('href="https://community.example.test/feed/p1"');
    expect(html).toContain('href="https://community.example.test/settings"');
  });

  it('escapes the post text', () => {
    const { html } = renderAnnouncement({ ...base, content: 'Titel\n<script>alert(1)</script> & mehr' });
    expect(html).not.toContain('<script>');
  });

  it('says when a video is attached and never embeds it', () => {
    const { html } = renderAnnouncement({ ...base, content: 'Titel', attachmentTypes: ['video/mp4'] });
    expect(html).toContain('Mit Video');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<audio');
  });

  it('has a subject even for an empty post', () => {
    expect(renderAnnouncement({ ...base, content: '' }).subject).toBe('GrowthLeaders: Neue Ankündigung');
  });
});

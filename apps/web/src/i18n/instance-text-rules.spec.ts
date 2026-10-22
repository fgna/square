import { describe, it, expect } from 'vitest';
import { applyOverrides, icuArguments, overrideProblems, PROTECTED_KEYS, textProblems } from './instance-text-rules.mjs';

const base = {
  de: {
    nav: { feed: 'Beiträge', bookmarks: 'Merkliste' },
    events: { seriesJoined: 'Für {count, plural, one {# Termin} other {# Termine}} zugesagt' },
    dashboard: { welcomeBack: 'Willkommen zurück, {name}!' },
    legal: { note: 'Siehe <link>Datenschutz</link>' },
    auth: { passwordMinLength: 'Passwort muss mindestens 8 Zeichen lang sein' },
  },
  en: {
    nav: { feed: 'Posts', bookmarks: 'Bookmarks' },
    events: { seriesJoined: "RSVP'd to {count, plural, one {# date} other {# dates}}" },
    dashboard: { welcomeBack: 'Welcome back, {name}!' },
    legal: { note: 'See <link>privacy</link>' },
    auth: { passwordMinLength: 'Password must be at least 8 characters' },
  },
};

describe('icuArguments', () => {
  it('finds simple, plural and nested arguments', () => {
    expect([...icuArguments('Hallo {name}')]).toEqual(['name']);
    expect([...icuArguments('{count, plural, one {# Termin} other {# Termine mit {who}}}')].sort()).toEqual(['count', 'who']);
    expect([...icuArguments("It's {n}'s turn")]).toEqual(['n']);
  });

  it('rejects unbalanced braces', () => {
    expect(() => icuArguments('Hallo {name')).toThrow();
    expect(() => icuArguments('Hallo }')).toThrow();
  });
});

describe('textProblems', () => {
  it('accepts plain text and fewer placeholders than the Core text', () => {
    expect(textProblems('Willkommen!', 'Willkommen zurück, {name}!')).toEqual([]);
    expect(textProblems('Schön, dass du da bist, {name}', 'Willkommen zurück, {name}!')).toEqual([]);
  });

  it('refuses placeholders the Core does not provide', () => {
    expect(textProblems('Hallo {vorname}', 'Hallo {name}')).toEqual(['uses placeholder {vorname} that the Core does not provide']);
  });

  it('refuses HTML and links, but keeps rich-text tags the Core text has', () => {
    expect(textProblems('<b>Hallo</b>', 'Hallo')).toContain('uses markup <b> that the Core text does not have');
    expect(textProblems('<a href="x">Hallo</a>', 'Hallo')).toContain('contains HTML');
    expect(textProblems('Mehr auf https://example.test', 'Mehr')).toEqual(['contains a link']);
    expect(textProblems('Lies <link>unsere Hinweise</link>', 'Siehe <link>Datenschutz</link>')).toEqual([]);
  });

  it('refuses empty and overlong text', () => {
    expect(textProblems('  ', 'x')).toEqual(['must be non-empty text']);
    expect(textProblems('x'.repeat(2001), 'x')).toEqual(['longer than 2000 characters']);
  });
});

describe('overrideProblems', () => {
  it('accepts the same keys in both languages', () => {
    expect(overrideProblems({ de: { nav: { feed: 'Forum' } }, en: { nav: { feed: 'Forum' } } }, base)).toEqual([]);
  });

  it('names unknown, protected and one-sided keys', () => {
    const problems = overrideProblems(
      {
        de: { nav: { feed: 'Forum', newThing: 'Neu' }, auth: { passwordMinLength: 'egal' } },
        en: { nav: { feed: 'Forum', newThing: 'New', bookmarks: 'Saved' }, auth: { passwordMinLength: 'whatever' } },
      },
      base,
    );
    expect(problems).toEqual(expect.arrayContaining([
      'de: nav.newThing: no such Core text',
      'de: auth.passwordMinLength: protected, stays as in the Core',
      'de: nav.bookmarks: missing (given in en)',
    ]));
  });

  it('checks every protected key against a real Core text', async () => {
    const core = (await import('../../messages/de.json')).default as Record<string, unknown>;
    const { flattenMessages } = await import('./instance-text-rules.mjs');
    const flat = flattenMessages(core);
    for (const key of PROTECTED_KEYS) expect(typeof flat[key], key).toBe('string');
  });
});

describe('applyOverrides', () => {
  it('replaces only the given texts and leaves the catalog untouched', () => {
    const out = applyOverrides(base.de, { nav: { feed: 'Forum' } });
    expect(out.nav).toEqual({ feed: 'Forum', bookmarks: 'Merkliste' });
    expect(base.de.nav.feed).toBe('Beiträge');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadInstanceMessages } from './instance-messages';
import { readActiveAssessmentIdentity } from './private-method-loader';

const originalRoot = process.env.COMMUNITY_CONTENT_DIR;
afterEach(() => {
  if (originalRoot === undefined) delete process.env.COMMUNITY_CONTENT_DIR;
  else process.env.COMMUNITY_CONTENT_DIR = originalRoot;
});

describe('runtime instance message activation from external pack', () => {
  const sample = resolve(process.cwd(), '../../examples/neutral-method-pack');

  it('keeps generic platform messages without explicit instance pack', async () => {
    delete process.env.COMMUNITY_CONTENT_DIR;
    const base = await loadInstanceMessages('en');
    expect(base.auth).toBeDefined();
  });

  it('loads DE and EN from an independent content checkout and preserves platform auth text', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'core-external-content-'));
    const pack = join(dir, 'content');
    try {
      cpSync(sample, pack, {recursive: true});
      process.env.COMMUNITY_CONTENT_DIR = pack;
      expect(await readActiveAssessmentIdentity(pack)).toMatchObject({instrumentId: 'neutral-sample', instrumentVersion: 'sample-v2', dimensions: ['Focus', 'Recovery', 'Connection', 'Learning', 'Wellbeing']});
      const de = await loadInstanceMessages('de');
      const en = await loadInstanceMessages('en');
      expect((de.assessment as {dimensions: Record<string, string>}).dimensions.Focus).toBe('Fokus');
      expect((de.assessment as {dimensions: Record<string, string>}).dimensions.Wellbeing).toBe('Wohlbefinden');
      expect((en.assessment as {dimensions: Record<string, string>}).dimensions.Recovery).toBe('Recovery');
      expect(de.auth).toBeDefined();
      expect(en.auth).toBeDefined();
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('applies instance texts (overrides.json) on top of Core and method texts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'core-instance-texts-'));
    const pack = join(dir, 'content');
    try {
      cpSync(sample, pack, {recursive: true});
      writeFileSync(join(pack, 'i18n/de/overrides.json'), JSON.stringify({ nav: { feed: 'Forum' }, assessment: { title: 'Mein Check' } }));
      writeFileSync(join(pack, 'i18n/en/overrides.json'), JSON.stringify({ nav: { feed: 'Forum' }, assessment: { title: 'My check' } }));
      process.env.COMMUNITY_CONTENT_DIR = pack;
      const de = await loadInstanceMessages('de');
      const en = await loadInstanceMessages('en');
      expect((de.nav as Record<string, string>).feed).toBe('Forum');
      expect((de.assessment as Record<string, unknown>).title).toBe('Mein Check');
      expect((en.assessment as Record<string, unknown>).title).toBe('My check');
      // Untouched Core and method texts stay.
      expect((de.nav as Record<string, string>).members).toBeTruthy();
      expect((de.assessment as {dimensions: Record<string, string>}).dimensions.Focus).toBe('Fokus');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('fails closed on invalid instance texts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'core-instance-texts-bad-'));
    const pack = join(dir, 'content');
    try {
      cpSync(sample, pack, {recursive: true});
      writeFileSync(join(pack, 'i18n/de/overrides.json'), JSON.stringify({ nav: { feed: 'Forum {extra}' } }));
      writeFileSync(join(pack, 'i18n/en/overrides.json'), JSON.stringify({ nav: { feed: 'Forum' } }));
      process.env.COMMUNITY_CONTENT_DIR = pack;
      await expect(loadInstanceMessages('de')).rejects.toThrow('nav.feed: uses placeholder {extra}');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('fails closed when an explicitly configured private content root is missing', async () => {
    process.env.COMMUNITY_CONTENT_DIR = sample + '-missing';
    await expect(loadInstanceMessages('de')).rejects.toThrow();
  });

  it('fails closed when the manifest instrument version does not match the definition', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'core-instrument-mismatch-'));
    const pack = join(dir, 'content');
    try {
      cpSync(sample, pack, {recursive: true});
      const {readFileSync, writeFileSync} = await import('node:fs');
      const manifestPath = join(pack, 'community.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.assessment.instrumentVersion = 'incompatible-version';
      writeFileSync(manifestPath, JSON.stringify(manifest));
      process.env.COMMUNITY_CONTENT_DIR = pack;
      await expect(loadInstanceMessages('en')).rejects.toThrow('identity mismatch');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});

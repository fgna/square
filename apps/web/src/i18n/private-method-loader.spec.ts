import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import de from '../../messages/de.json';
import en from '../../messages/en.json';
import { prepareBilingualMethodMessages, readPrivateMethodMessages } from './private-method-loader';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'private-locale-'));
  roots.push(root);
  await mkdir(join(root, 'i18n', 'de'), { recursive: true });
  await mkdir(join(root, 'i18n', 'en'), { recursive: true });
  return root;
}
const file = (root: string, locale: string) => join(root, 'i18n', locale, 'method.json');
describe('private bilingual method file preparation', () => {
  it('loads separate DE and EN method text without touching generic controls', async () => {
    const root = await fixture();
    await writeFile(file(root, 'de'), JSON.stringify({ journal: { goalsLabel: 'Private DE' } }));
    await writeFile(file(root, 'en'), JSON.stringify({ journal: { goalsLabel: 'Private EN' } }));
    const base = (messages: typeof en) => ({ ...messages, journal: { goalsLabel: 'Notes' } });
    const result = await prepareBilingualMethodMessages(root, { de: base(de), en: base(en) });
    expect((result.de.journal as Record<string, unknown>).goalsLabel).toBe('Private DE');
    expect((result.en.journal as Record<string, unknown>).goalsLabel).toBe('Private EN');
    expect(result.de.auth).toBe(de.auth);
    expect(result.en.auth).toBe(en.auth);
  });
  it('fails if a private language file is missing', async () => {
    const root = await fixture();
    await writeFile(file(root, 'de'), '{}');
    await expect(prepareBilingualMethodMessages(root, { de, en })).rejects.toThrow();
  });
  it('fails on unsafe protected keys in either locale', async () => {
    const root = await fixture();
    await writeFile(file(root, 'de'), '{}');
    await writeFile(file(root, 'en'), '{"auth":{"signIn":"Override"}}');
    await expect(prepareBilingualMethodMessages(root, { de, en })).rejects.toThrow();
  });
  it('rejects a symlinked private locale file', async () => {
    const root = await fixture();
    const target = join(root, 'target.json');
    await writeFile(target, '{}');
    await symlink(target, file(root, 'de'));
    await expect(readPrivateMethodMessages(root, 'de')).rejects.toThrow();
  });
  it('rejects oversized private locale files', async () => {
    const root = await fixture();
    await writeFile(file(root, 'de'), ' '.repeat(256 * 1024 + 1));
    await expect(readPrivateMethodMessages(root, 'de')).rejects.toThrow();
  });
});

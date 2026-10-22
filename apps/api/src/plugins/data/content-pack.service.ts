import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PluginContentPack } from '@community/plugin-sdk/api';
import { inspectCommunityContentPack } from '../../community-config/content-pack-inspector';
import { validateJournalMethodLocale, JournalMethodLocale } from '../../community-config/journal-method-locale';
import { validateJournalMethodDefinition, JournalMethodDefinition } from '../../community-config/journal-method-definition';

/**
 * The instance's content pack (COMMUNITY_CONTENT_SOURCE=pack, files in
 * COMMUNITY_CONTENT_DIR). Each file is inspected, hash-checked and validated
 * once; the result is pinned for the lifetime of the process.
 */
@Injectable()
export class ContentPackService implements PluginContentPack {
  private methodSnapshot?: Promise<JournalMethodDefinition>;
  private textsSnapshot?: Promise<{ de: JournalMethodLocale; en: JournalMethodLocale }>;

  source(): 'legacy' | 'pack' {
    const source = process.env.COMMUNITY_CONTENT_SOURCE;
    if (!source || source === 'legacy') return 'legacy';
    if (source === 'pack') return 'pack';
    throw new Error('Unsupported COMMUNITY_CONTENT_SOURCE value');
  }

  async journalMethod(): Promise<JournalMethodDefinition | null> {
    if (this.source() === 'legacy') return null;
    if (!this.methodSnapshot) this.methodSnapshot = this.readMethod();
    return this.methodSnapshot;
  }

  async journalTexts(locale: 'de' | 'en'): Promise<JournalMethodLocale | null> {
    if (this.source() === 'legacy') return null;
    if (!this.textsSnapshot) this.textsSnapshot = this.readTexts();
    return (await this.textsSnapshot)[locale];
  }

  private async readMethod(): Promise<JournalMethodDefinition> {
    const root = process.env.COMMUNITY_CONTENT_DIR;
    if (!root) throw new Error('COMMUNITY_CONTENT_DIR required in pack mode');
    const inspection = await inspectCommunityContentPack(root);
    const definition = inspection.manifest.journal?.definition;
    if (!definition) throw new Error('Pack mode requires journal definition');
    const expected = inspection.files.find(f => f.path === definition)?.sha256;
    if (!expected) throw new Error('Journal definition not inspected');
    const text = await readFile(resolve(root, definition), 'utf8');
    if (createHash('sha256').update(text).digest('hex') !== expected) {
      throw new Error('Journal definition changed during inspection');
    }
    return validateJournalMethodDefinition(JSON.parse(text));
  }

  private async readTexts(): Promise<{ de: JournalMethodLocale; en: JournalMethodLocale }> {
    const method = await this.journalMethod();
    if (!method) throw new Error('Method pack required for private journal translations');
    const root = process.env.COMMUNITY_CONTENT_DIR!;
    const inspection = await inspectCommunityContentPack(root);
    const locations = inspection.manifest.journal?.translations;
    if (!locations) throw new Error('Bilingual journal translations missing from content pack');
    const readLocale = async (path: string): Promise<JournalMethodLocale> => {
      const expected = inspection.files.find(f => f.path === path)?.sha256;
      if (!expected) throw new Error('Journal locale file was not inspected');
      const text = await readFile(resolve(root, path), 'utf8');
      if (createHash('sha256').update(text).digest('hex') !== expected) {
        throw new Error('Journal locale changed during inspection');
      }
      return validateJournalMethodLocale(JSON.parse(text), method);
    };
    const [de, en] = await Promise.all([readLocale(locations.de), readLocale(locations.en)]);
    return { de, en };
  }
}

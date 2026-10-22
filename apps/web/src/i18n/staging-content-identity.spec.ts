import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectCommunityContentPack } from '../../../api/src/community-config/content-pack-inspector';
import { readActiveAssessmentIdentity, prepareCompleteBilingualMethodMessages } from './private-method-loader';
import de from '../../messages/de.json';
import en from '../../messages/en.json';

// Cross-stack integration test: the API inspector and Web loader independently
// inspect the same separately supplied content root. No DB or live demo access.
describe('pinned staging pack identity across API and Web implementations', () => {
  it('agrees on instrument identity, version and bilingual dimension catalog', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'independent-staging-content-'));
    const content = join(tmp, 'content');
    try {
      cpSync(resolve(process.cwd(), '../../examples/neutral-method-pack'), content, { recursive: true });
      const api = await inspectCommunityContentPack(content);
      const web = await readActiveAssessmentIdentity(content);
      expect(web.instrumentId).toBe(api.manifest.assessment?.instrumentId);
      expect(web.instrumentVersion).toBe(api.manifest.assessment?.instrumentVersion);
      expect(web.dimensions).toEqual(['Focus', 'Recovery', 'Connection', 'Learning', 'Wellbeing']);
      const messages = await prepareCompleteBilingualMethodMessages(content, { de, en }, { dimensions: web.dimensions });
      for (const locale of ['de', 'en'] as const) {
        const assessment = messages[locale].assessment as { dimensions: Record<string, string> };
        expect(Object.keys(assessment.dimensions).sort()).toEqual([...web.dimensions].sort());
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

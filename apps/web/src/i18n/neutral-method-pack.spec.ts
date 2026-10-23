import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import en from '../../messages/en.json';
import de from '../../messages/de.json';
import { prepareCompleteBilingualMethodMessages } from './private-method-loader';

describe('neutral method pack bilingual overlays', () => {
  it('activates complete synthetic DE/EN method labels against neutral UI without overriding auth', async () => {
    const root = resolve(process.cwd(), '../../examples/neutral-method-pack');
    const result = await prepareCompleteBilingualMethodMessages(root, { de, en }, { dimensions: ['Focus', 'Recovery', 'Connection', 'Learning', 'Wellbeing'] });
    const deAssessment = result.de.assessment as Record<string, Record<string, string>>;
    const enAssessment = result.en.assessment as Record<string, Record<string, string>>;
    expect(Object.keys(deAssessment.dimensions)).toEqual(['Focus', 'Recovery', 'Connection', 'Learning', 'Wellbeing']);
    expect(Object.keys(enAssessment.dimensions)).toEqual(['Focus', 'Recovery']);
    expect(deAssessment.dimensions.Focus).toBe('Fokus');
    expect(enAssessment.dimensions.Focus).toBe('Focus');
    expect(result.de.auth).toBe(de.auth);
    expect(result.en.auth).toBe(en.auth);
  });

  it('fails closed if active instrument dimensions differ', async () => {
    const root = resolve(process.cwd(), '../../examples/neutral-method-pack');
    await expect(prepareCompleteBilingualMethodMessages(root, { de, en }, { dimensions: ['Wrong'] }))
      .rejects.toThrow();
  });
});

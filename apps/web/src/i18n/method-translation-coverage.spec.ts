import { describe, expect, it } from 'vitest';
import { METHOD_TRANSLATION_KEYS, applyMethodTranslations, requireCompleteMethodTranslations } from './method-message-layers';

const synthetic = () => ({
  assessment: Object.fromEntries(METHOD_TRANSLATION_KEYS.assessment.map(key => [key, 'synthetic-' + key])),
  journal: Object.fromEntries(METHOD_TRANSLATION_KEYS.journal.map(key => [key, 'synthetic-' + key])),
});

describe('private translation coverage before clean activation', () => {
  it('rejects an empty pack despite valid legacy base translations', () => {
    expect(() => requireCompleteMethodTranslations({})).toThrow();
  });
  it('rejects incomplete method-owned assessment and journal sections', () => {
    const missingAssessment = synthetic();
    delete (missingAssessment.assessment as Record<string, string>).instructions;
    expect(() => requireCompleteMethodTranslations(missingAssessment)).toThrow('assessment');
    const missingJournal = synthetic();
    delete (missingJournal.journal as Record<string, string>).goalsLabel;
    expect(() => requireCompleteMethodTranslations(missingJournal)).toThrow('journal');
  });
  it('accepts exactly the declared method-owned keys', () => {
    expect(() => requireCompleteMethodTranslations(synthetic())).not.toThrow();
  });
  it('rejects missing namespace even if the other namespace is complete', () => {
    expect(() => requireCompleteMethodTranslations({ assessment: synthetic().assessment })).toThrow('journal');
  });
  it('supports explicitly narrowed coverage only for a separately reviewed scope', () => {
    expect(() => requireCompleteMethodTranslations({ assessment: synthetic().assessment }, ['assessment'])).not.toThrow();
  });
});

describe('structured assessment scale runtime overlay', () => {
  const base = { assessment: { scale: 'Legacy scale' }, auth: { signIn: 'Sign in' } };
  const labels = { '1': 'Low', '2': 'Below average', '3': 'Average', '4': 'Above average', '5': 'High', na: 'Not assessable' };
  it('activates scale levels without affecting protected platform namespaces', () => {
    const result = applyMethodTranslations(base, { assessment: { scale: labels } });
    expect((result.assessment as Record<string, unknown>).scale).toEqual(labels);
    expect(result.auth).toBe(base.auth);
    expect((base.assessment as Record<string, unknown>).scale).toBe('Legacy scale');
  });
  it('retains legacy string scales', () => {
    const result = applyMethodTranslations(base, { assessment: { scale: 'Low through high' } });
    expect((result.assessment as Record<string, unknown>).scale).toBe('Low through high');
  });
  it.each(['missing', 'blank', 'extra', 'nonstring'])('rejects %s scale object', mutation => {
    const changed: Record<string, unknown> = { ...labels };
    if (mutation === 'missing') delete changed['3'];
    if (mutation === 'blank') changed['3'] = '  ';
    if (mutation === 'extra') changed['6'] = 'Unsupported';
    if (mutation === 'nonstring') changed['3'] = 3;
    expect(() => applyMethodTranslations(base, { assessment: { scale: changed } })).toThrow('assessment.scale');
  });
});

describe('structured assessment bands runtime overlay', () => {
  const base = { assessment: { bands: 'Legacy bands' }, auth: { signIn: 'Sign in' } };
  const labels = { strength: 'Strong', solid: 'Stable', develop: 'Developing' };
  it('accepts per-band labels without replacing platform text', () => {
    const result = applyMethodTranslations(base, { assessment: { bands: labels } });
    expect((result.assessment as Record<string, unknown>).bands).toEqual(labels);
    expect(result.auth).toBe(base.auth);
  });
  it('retains legacy band strings', () => {
    const result = applyMethodTranslations(base, { assessment: { bands: 'Existing' } });
    expect((result.assessment as Record<string, unknown>).bands).toBe('Existing');
  });
  it.each(['missing', 'blank', 'extra', 'nonstring'])('rejects %s band entry', mutation => {
    const changed: Record<string, unknown> = { ...labels };
    if (mutation === 'missing') delete changed.solid;
    if (mutation === 'blank') changed.solid = ' ';
    if (mutation === 'extra') changed.unexpected = 'Unknown';
    if (mutation === 'nonstring') changed.solid = 4;
    expect(() => applyMethodTranslations(base, { assessment: { bands: changed } })).toThrow('assessment.bands');
  });
});

describe('platform journal mood ownership', () => {
  const base = { journal: { ...Object.fromEntries(METHOD_TRANSLATION_KEYS.journal.map(key => [key, 'Platform ' + key])), moods: 'Platform wording' }, journalMoodUI: { calm: 'Calm' } };
  it('accepts method content without moods', () => {
    const pack = synthetic();
    expect(() => requireCompleteMethodTranslations(pack)).not.toThrow();
    const result = applyMethodTranslations(base, { journal: { goalsLabel: 'Personal goals' } });
    expect((result.journal as Record<string, unknown>).moods).toBe('Platform wording');
    expect(result.journalMoodUI).toBe(base.journalMoodUI);
  });
  it('ignores legacy moods while preserving the platform catalogue', () => {
    const pack = synthetic();
    (pack.journal as Record<string, unknown>).moods = { old: 'Legacy value' };
    expect(() => requireCompleteMethodTranslations(pack)).not.toThrow();
    const result = applyMethodTranslations(base, { journal: pack.journal });
    expect((result.journal as Record<string, unknown>).moods).toBe('Platform wording');
    expect(result.journalMoodUI).toBe(base.journalMoodUI);
  });
  it('rejects unrelated protected keys', () => {
    expect(() => applyMethodTranslations(base, { journal: { auth: 'unsafe' } })).toThrow();
  });
});

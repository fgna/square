import { describe, it, expect } from 'vitest';
import { validateCommunityContentManifest } from './content-manifest';

const valid = {
  schemaVersion: 1,
  id: 'sample-community',
  version: '1.0.0',
  platformCompatibility: '^1.0.0',
  locales: ['de', 'en'],
  assessment: {
    instrumentId: 'sample-assessment',
    instrumentVersion: 'v1',
    definition: 'assessments/sample.json',
  },
  branding: 'branding/theme.json',
};

describe('validateCommunityContentManifest', () => {
  it('accepts a declarative manifest without activating it', () => {
    expect(validateCommunityContentManifest(valid)).toEqual(valid);
  });

  it('rejects unsupported versions and unknown properties', () => {
    expect(() => validateCommunityContentManifest({ ...valid, schemaVersion: 2 })).toThrow('schemaVersion');
    expect(() => validateCommunityContentManifest({ ...valid, arbitraryCode: 'run' })).toThrow('unknown property');
  });

  it('rejects invalid identifiers, versions and locales', () => {
    expect(() => validateCommunityContentManifest({ ...valid, id: '../secret' })).toThrow();
    expect(() => validateCommunityContentManifest({ ...valid, version: 'latest' })).toThrow();
    expect(() => validateCommunityContentManifest({ ...valid, locales: ['de', 'de'] })).toThrow();
    expect(() => validateCommunityContentManifest({ ...valid, locales: [] })).toThrow();
  });

  it.each(['../private.json', '/etc/passwd', 'a/../../private.json', 'a\\private.json', 'https://example.com/pack'])(
    'rejects unsafe content path %s',
    (definition) => {
      expect(() => validateCommunityContentManifest({
        ...valid, assessment: { ...valid.assessment, definition },
      })).toThrow();
    },
  );

  it('supports a community with no assessment', () => {
    const { assessment, branding, ...generic } = valid;
    expect(validateCommunityContentManifest(generic)).toEqual(generic);
  });

  it('does not return unvalidated caller-owned metadata', () => {
    const input = { ...valid, locales: ['en'] };
    const parsed = validateCommunityContentManifest(input);
    input.locales.push('de');
    expect(parsed.locales).toEqual(['en']);
  });
});

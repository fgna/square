import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sample = join(root, 'examples/neutral-method-pack');
const checker = join(root, 'scripts/validate-instance-pack.mjs');
function run(mutate) {
  const temp = mkdtempSync(join(tmpdir(), 'core-pack-preflight-'));
  const pack = join(temp, 'content');
  try {
    cpSync(sample, pack, { recursive: true });
    mutate?.(pack);
    return spawnSync(process.execPath, [checker, pack], { encoding: 'utf8' });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
function edit(pack, path, fn) {
  const file = join(pack, path);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  fn(json);
  writeFileSync(file, JSON.stringify(json));
}
test('synthetic independent checkout passes', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS/);
});
test('incompatible platform fails without exposing content', () => {
  const result = run(pack => edit(pack, 'community.json', v => { v.platformCompatibility = '^99.0.0'; }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PLATFORM_COMPATIBILITY_UNSUPPORTED/);
});
test('mismatched instrument identity fails', () => {
  const result = run(pack => edit(pack, 'community.json', v => { v.assessment.instrumentVersion = 'different'; }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ASSESSMENT_IDENTITY_MISMATCH/);
});
test('missing German assessment translation fails', () => {
  const result = run(pack => edit(pack, 'i18n/de/method.json', v => { delete v.assessment.dimensions.Focus; }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /METHOD_DE_INCOMPLETE/);
});
test('traversal is refused', () => {
  const result = run(pack => edit(pack, 'community.json', v => { v.assessment.definition = '../../other.json'; }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ASSESSMENT_PATH_INVALID/);
});

test('symlinked translation file is refused', () => {
  const result = run(pack => {
    const file = join(pack, 'i18n/en/method.json');
    unlinkSync(file);
    symlinkSync(join(sample, 'i18n/en/method.json'), file);
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /METHOD_EN_MISSING_OR_INVALID/);
});
test('translation override outside method namespaces is refused', () => {
  const result = run(pack => edit(pack, 'i18n/en/method.json', v => { v.auth = { login: 'override' }; }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /METHOD_EN_UNSAFE_NAMESPACE/);
});

for (const locale of ['de', 'en']) {
  test(`${locale}: structured scale labels pass preflight`, () => {
    const result = run(pack => edit(pack, `i18n/${locale}/method.json`, v => {
      v.assessment.scale = { '1': 'Low', '2': 'Below average', '3': 'Middle', '4': 'Above average', '5': 'High', na: 'Not assessable' };
    }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  });
  for (const mutation of ['missing', 'blank', 'extra', 'nonstring']) {
    test(`${locale}: malformed structured scale (${mutation}) fails`, () => {
      const result = run(pack => edit(pack, `i18n/${locale}/method.json`, v => {
        const scale = { '1': 'Low', '2': 'Low', '3': 'Middle', '4': 'High', '5': 'High', na: 'Not assessable' };
        if (mutation === 'missing') delete scale['3'];
        if (mutation === 'blank') scale['3'] = '  ';
        if (mutation === 'extra') scale['6'] = 'Unsupported';
        if (mutation === 'nonstring') scale['3'] = 3;
        v.assessment.scale = scale;
      }));
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`METHOD_${locale.toUpperCase()}_INCOMPLETE`));
    });
  }
}

for (const locale of ['de', 'en']) {
  test(`${locale}: structured band labels pass preflight`, () => {
    const result = run(pack => edit(pack, `i18n/${locale}/method.json`, value => {
      value.assessment.bands = { strength: 'Strong', solid: 'Stable', develop: 'Developing' };
    }));
    assert.equal(result.status, 0, result.stderr);
  });
  for (const mutation of ['missing', 'blank', 'extra', 'nonstring']) {
    test(`${locale}: invalid structured bands (${mutation}) fail`, () => {
      const result = run(pack => edit(pack, `i18n/${locale}/method.json`, value => {
        const bands = { strength: 'Strong', solid: 'Stable', develop: 'Developing' };
        if (mutation === 'missing') delete bands.solid;
        if (mutation === 'blank') bands.solid = ' ';
        if (mutation === 'extra') bands.unknown = 'Unknown';
        if (mutation === 'nonstring') bands.solid = 4;
        value.assessment.bands = bands;
      }));
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`METHOD_${locale.toUpperCase()}_INCOMPLETE`));
    });
  }
}

for (const locale of ['de', 'en']) {
  test(`${locale}: oversized structured band fails preflight like Web loader`, () => {
    const result = run(pack => edit(pack, `i18n/${locale}/method.json`, value => {
      value.assessment.bands = { strength: 'x'.repeat(8001), solid: 'Stable', develop: 'Developing' };
    }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`METHOD_${locale.toUpperCase()}_INCOMPLETE`));
  });
}

for (const locale of ['de', 'en']) {
  test(`${locale}: journal moods are optional platform text`, () => {
    const result = run(pack => edit(pack, `i18n/${locale}/method.json`, value => {
      delete value.journal.moods;
    }));
    assert.equal(result.status, 0, result.stderr);
  });
}

test('extra method texts are refused; they belong in overrides.json', () => {
  const result = run(pack => edit(pack, 'i18n/de/method.json', json => { json.assessment.title = 'Mein Check'; }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /METHOD_DE_ASSESSMENT_KEYS/);
});

test('valid instance texts pass and are counted', () => {
  const result = run(pack => {
    writeFileSync(join(pack, 'i18n/de/overrides.json'), JSON.stringify({ nav: { feed: 'Forum' }, assessment: { title: 'Mein Check' } }));
    writeFileSync(join(pack, 'i18n/en/overrides.json'), JSON.stringify({ nav: { feed: 'Forum' }, assessment: { title: 'My check' } }));
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Instance texts: 2 Core texts replaced/);
});

test('instance texts with unknown placeholders, links or protected keys fail', () => {
  const result = run(pack => {
    writeFileSync(join(pack, 'i18n/de/overrides.json'), JSON.stringify({ nav: { feed: 'Forum {x}' }, auth: { passwordMinLength: 'egal' } }));
    writeFileSync(join(pack, 'i18n/en/overrides.json'), JSON.stringify({ nav: { feed: 'see https://example.test' }, auth: { passwordMinLength: 'any' } }));
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OVERRIDES_INVALID/);
  assert.match(result.stderr, /de: nav\.feed: uses placeholder \{x\}/);
  assert.match(result.stderr, /en: nav\.feed: contains a link/);
  assert.match(result.stderr, /auth\.passwordMinLength: protected/);
});


test('optional community theme palette passes preflight', () => {
  const result = run(pack => edit(pack, 'community.json', value => {
    value.branding = { theme: 'corporate-light', colors: { primary: '#245A81', secondary: '#745DA8', accent: '#BB7733' } };
  }));
  assert.equal(result.status, 0, result.stderr);
});

for (const branding of [
  { theme: 'missing-theme', colors: { primary: '#123456' } },
  { theme: 'corporate-light', colors: { primary: 'red' } },
  { theme: 'corporate-light', colors: { background: '#ffffff' } },
]) {
  test('invalid community branding is rejected by preflight', () => {
    const result = run(pack => edit(pack, 'community.json', value => { value.branding = branding; }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BRANDING_INVALID/);
  });
}

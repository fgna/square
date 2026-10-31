import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountFile, testAccount } from './authenticated.accounts.ts';

test('scopes isolate learner state while preserving the legacy account filename', () => {
  const origin = 'https://synthetic.example.test';
  const root = mkdtempSync(join(tmpdir(), 'square-account-'));
  try {
    const legacy = accountFile(origin, '', root);
    assert.equal(legacy, join(root, `playwright-account-${createHash('sha256').update(origin).digest('hex').slice(0, 12)}.json`));
    writeFileSync(legacy, JSON.stringify({ email: 'old@example.test', password: 'synthetic-only' }));
    assert.equal(testAccount(origin, '', {}, root).email, 'old@example.test');
    assert.notEqual(accountFile(origin, 'mecki-grade2', root), legacy);
    assert.throws(() => testAccount(origin, 'mecki-grade2', {}, root), /No synthetic member/);
    const scoped = testAccount(origin, 'mecki-grade2', { SQUARE_TEST_ALLOW_SIGNUP: '1' }, root);
    assert.equal(scoped.newlyGenerated, true);
    assert.notEqual(scoped.email, 'old@example.test');
    assert.equal(readdirSync(root).length, 1, 'selection never writes credentials before registration');
    writeFileSync(scoped.file, JSON.stringify({ email: scoped.email, password: scoped.password, newlyGenerated: true }));
    assert.equal(testAccount(origin, 'mecki-grade2', {}, root).newlyGenerated, false);
    assert.equal(testAccount(origin, '', {}, root).email, 'old@example.test');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('scoped credentials do not reuse the global test account', () => {
  const root = mkdtempSync(join(tmpdir(), 'square-account-'));
  try {
    const env = { SQUARE_TEST_EMAIL: 'global@example.test', SQUARE_TEST_PASSWORD: 'synthetic-only' };
    assert.throws(() => testAccount('https://example.test', 'mecki-grade2', env, root), /No synthetic member/);
    const selected = testAccount('https://example.test', 'mecki-grade2', { ...env,
      SQUARE_TEST_MECKI_GRADE2_EMAIL: 'mecki@example.test', SQUARE_TEST_MECKI_GRADE2_PASSWORD: 'synthetic-only' }, root);
    assert.equal(selected.email, 'mecki@example.test');
    assert.throws(() => testAccount('https://example.test', 'mecki-grade2', { SQUARE_TEST_MECKI_GRADE2_EMAIL: 'only@example.test' }, root), /Both/);
    assert.throws(() => accountFile('https://example.test', '../bad', root), /Invalid/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

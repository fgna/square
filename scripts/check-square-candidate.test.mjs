import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCandidate } from './check-square-candidate.mjs';

test('accepts a validated newer stable tagged candidate', async () => {
  const result = await checkCandidate('1.0.0', '/tmp/candidate.json', {
    validate: () => 'PASS: staging pair validated',
    resolveVersion: async () => 'v1.1.0',
  });
  assert.equal(result.candidate, 'v1.1.0');
});

test('refuses unchanged or older Square versions', async () => {
  for (const version of ['v1.0.0', 'v0.9.9']) {
    await assert.rejects(checkCandidate('1.0.0', '/tmp/candidate.json', {
      validate: () => 'PASS',
      resolveVersion: async () => version,
    }), /newer stable/);
  }
});

test('refuses candidate if pinned content validation fails', async () => {
  let resolved = false;
  await assert.rejects(checkCandidate('1.0.0', '/tmp/candidate.json', {
    validate: () => { throw new Error('CONTENT_PREFLIGHT_FAILED'); },
    resolveVersion: async () => { resolved = true; return 'v1.1.0'; },
  }), /CONTENT_PREFLIGHT_FAILED/);
  assert.equal(resolved, false);
});

test('refuses invalid installed version', async () => {
  await assert.rejects(checkCandidate('latest', '/tmp/pair', {
    validate: () => 'PASS', resolveVersion: async () => 'v2.0.0',
  }), /Invalid installed/);
});

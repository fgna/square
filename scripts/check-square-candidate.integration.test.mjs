import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = resolve(fileURLToPath(new URL('..', import.meta.url)));
function git(path, ...args) {
  return execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim();
}
function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'square-candidate-gate-'));
  const core = join(root, 'core');
  const content = join(root, 'instance');
  try {
    mkdirSync(join(core, 'scripts'), { recursive: true });
    for (const script of ['check-square-update.mjs', 'check-square-candidate.mjs',
      'validate-staging-pair.mjs', 'validate-instance-pack.mjs']) {
      cpSync(join(source, 'scripts', script), join(core, 'scripts', script));
    }
    mkdirSync(join(core, 'apps/web/src/i18n'), { recursive: true });
    cpSync(join(source, 'apps/web/src/i18n/instance-text-rules.mjs'),
      join(core, 'apps/web/src/i18n/instance-text-rules.mjs'));
    cpSync(join(source, 'apps/web/messages'), join(core, 'apps/web/messages'), { recursive: true });
    git(core, 'init', '-q');
    git(core, 'add', '.');
    git(core, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Core');
    git(core, 'tag', 'v1.1.0');
    cpSync(join(source, 'examples/neutral-method-pack'), join(content, 'content'), { recursive: true });
    git(content, 'init', '-q');
    git(content, 'add', '.');
    git(content, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Instance');
    const pair = { instanceId: 'square-candidate-test',
      core: { checkout: core, revision: git(core, 'rev-parse', 'HEAD') },
      content: { checkout: content, revision: git(content, 'rev-parse', 'HEAD'), root: 'content' } };
    const path = join(root, 'pair.json');
    const run = () => {
      writeFileSync(path, JSON.stringify(pair));
      return spawnSync(process.execPath,
        [join(core, 'scripts/check-square-candidate.mjs'), '--current', '1.0.0',
          '--candidate-pair', path],
        { cwd: core, encoding: 'utf8' });
    };
    return callback({ pair, run, content, core });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('real pinned Git pair accepts compatible newer candidate', () => fixture(({ run }) => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: Candidate Square v1.1.0/);
}));
test('real pinned Git pair refuses wrong instance revision', () => fixture(({ pair, run }) => {
  pair.content.revision = '0'.repeat(40);
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Candidate preflight rejected/);
}));
test('real pinned Git pair refuses dirty instance checkout', () => fixture(({ content, run }) => {
  writeFileSync(join(content, 'untracked.txt'), 'unreviewed');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Candidate preflight rejected/);
}));

test('committed incompatible pack blocks promotion without changing the accepted pair or extension', () => fixture(({ pair, run, content, core }) => {
  const accepted = structuredClone(pair);
  const extension = join(content, 'extension.mjs');
  writeFileSync(extension, 'export const instanceOwned = true;\n');
  git(content, 'add', '.');
  git(content, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Instance extension');
  accepted.content.revision = git(content, 'rev-parse', 'HEAD');
  const originalExtension = readFileSync(extension, 'utf8');
  const manifest = join(content, 'content/community.json');
  const json = JSON.parse(readFileSync(manifest, 'utf8'));
  json.platformCompatibility = '^99.0.0';
  writeFileSync(manifest, JSON.stringify(json));
  git(content, 'add', '.');
  git(content, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Incompatible candidate');
  pair.content.revision = git(content, 'rev-parse', 'HEAD');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Candidate preflight rejected/);
  assert.equal(readFileSync(extension, 'utf8'), originalExtension);
  assert.equal(git(core, 'rev-parse', 'HEAD'), accepted.core.revision);
  git(content, 'checkout', '--detach', accepted.content.revision);
  pair.content.revision = accepted.content.revision;
  assert.equal(run().status, 0, 'previous reviewed pair remains usable');
}));


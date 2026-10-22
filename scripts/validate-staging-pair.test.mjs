import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const core = resolve(fileURLToPath(new URL('..', import.meta.url)));

function git(path, ...args) {
  return execFileSync('git', ['-C', path, ...args], {encoding:'utf8'}).trim();
}
function fixture(callback) {
  const work = mkdtempSync(join(tmpdir(), 'core-staging-pair-'));
  const contentRepo = join(work, 'private-checkout');
  const cleanCore = join(work, 'core-checkout');
  const coreRepo = join(work, 'core-checkout');
  try {
    // Reproduce a clean pinned Core checkout without touching the developer's
    // working tree, which can legitimately contain unrelated local changes.
    mkdirSync(join(coreRepo, 'scripts'), {recursive:true});
    cpSync(join(core, 'scripts/validate-staging-pair.mjs'), join(coreRepo, 'scripts/validate-staging-pair.mjs'));
    cpSync(join(core, 'scripts/validate-instance-pack.mjs'), join(coreRepo, 'scripts/validate-instance-pack.mjs'));
    // The pack check uses the instance text rules and the Core catalogs.
    mkdirSync(join(coreRepo, 'apps/web/src/i18n'), {recursive:true});
    cpSync(join(core, 'apps/web/src/i18n/instance-text-rules.mjs'), join(coreRepo, 'apps/web/src/i18n/instance-text-rules.mjs'));
    cpSync(join(core, 'apps/web/messages'), join(coreRepo, 'apps/web/messages'), {recursive:true});
    git(coreRepo, 'init', '-q');
    git(coreRepo, 'add', '.');
    git(coreRepo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', 'commit', '-qm', 'Synthetic Core');
    cpSync(join(core, 'examples/neutral-method-pack'), join(contentRepo, 'content'), {recursive:true});
    git(contentRepo, 'init');
    git(contentRepo, 'add', '.');
    git(contentRepo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', 'commit', '-m', 'Synthetic package');
    const pair = {
      instanceId:'staging-test',
      core: {checkout:coreRepo, revision:git(coreRepo, 'rev-parse', 'HEAD')},
      content: {checkout:contentRepo, revision:git(contentRepo, 'rev-parse', 'HEAD'), root:'content'},
    };
    return callback(pair, join(work, 'pair.json'), join(coreRepo, 'scripts/validate-staging-pair.mjs'));
  } finally { rmSync(work, {recursive:true, force:true}); }
}
function run(pair, path, checker) {
  writeFileSync(path, JSON.stringify(pair));
  return spawnSync(process.execPath, [join(pair.core.checkout, 'scripts/validate-staging-pair.mjs'), path], {encoding:'utf8'});
}
test('accepts two clean pinned revisions and synthetic pack', () => fixture((pair, path, checker) => {
  const result = run(pair, path, checker);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /pinned staging pair validated/);
}));
test('rejects wrong content revision', () => fixture((pair, path, checker) => {
  pair.content.revision = '0'.repeat(40);
  const result = run(pair, path, checker);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CONTENT_REVISION_MISMATCH/);
}));
test('rejects private checkout with uncommitted content', () => fixture((pair, path, checker) => {
  writeFileSync(join(pair.content.checkout, 'untracked.txt'), 'not pinned');
  const result = run(pair, path, checker);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CONTENT_CHECKOUT_DIRTY/);
}));

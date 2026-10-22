#!/usr/bin/env node
// Validates two already-checked-out immutable Git revisions before staging.
// No cloning, credentials, uploads, remote fetch or deployment side effects.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ownRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
function refuse(code) { console.error('FAIL: ' + code); process.exit(1); }
function git(dir, args) {
  try { return execFileSync('git', ['-C', dir, ...args], {encoding:'utf8', timeout:10000}).trim(); }
  catch { refuse('GIT_CHECK_FAILED'); }
}
if (process.argv.length !== 3) {
  console.error('Usage: node scripts/validate-staging-pair.mjs /absolute/path/to/staging-pair.json');
  process.exit(2);
}
let file, manifest;
try {
  file = process.argv[2];
  if (!isAbsolute(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) throw Error();
  manifest = JSON.parse(readFileSync(file, 'utf8'));
} catch { refuse('PAIR_MANIFEST_INVALID'); }
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(manifest.instanceId ?? '') ||
    !manifest.core || !manifest.content ||
    !sha(manifest.core.revision) || !sha(manifest.content.revision) ||
    typeof manifest.core.checkout !== 'string' || typeof manifest.content.checkout !== 'string' ||
    typeof manifest.content.root !== 'string') refuse('PAIR_CONTRACT_INVALID');
function checkout(path) {
  try {
    if (!isAbsolute(path) || resolve(path) !== realpathSync(path)) throw Error();
    const root = git(path, ['rev-parse', '--show-toplevel']);
    if (root !== path || !lstatSync(root).isDirectory()) throw Error();
    return root;
  } catch { refuse('CHECKOUT_NOT_CANONICAL'); }
}
const core = checkout(manifest.core.checkout);
const content = checkout(manifest.content.checkout);
if (core !== ownRoot || core === content) refuse('PAIR_CHECKOUT_MISMATCH');
for (const [name, path, revision] of [
  ['CORE', core, manifest.core.revision],
  ['CONTENT', content, manifest.content.revision],
]) {
  if (git(path, ['rev-parse', 'HEAD']) !== revision) refuse(name + '_REVISION_MISMATCH');
  if (git(path, ['status', '--porcelain', '--untracked-files=normal']) !== '') {
    refuse(name + '_CHECKOUT_DIRTY');
  }
}
const pack = resolve(content, manifest.content.root);
if (pack === content || !pack.startsWith(content + '/')) refuse('CONTENT_PATH_INVALID');
try {
  if (realpathSync(pack) !== pack || !lstatSync(pack).isDirectory()) throw Error();
} catch { refuse('CONTENT_PATH_INVALID'); }
try {
  execFileSync(process.execPath, [join(core, 'scripts/validate-instance-pack.mjs'), pack],
    {stdio:'inherit', timeout:10000});
} catch { refuse('CONTENT_PREFLIGHT_FAILED'); }
console.log('PASS: pinned staging pair validated; instance=' + manifest.instanceId);
console.log('Core and content HEADs match reviewed revisions; no deployment performed.');
console.log('Deploy both API and Web with COMMUNITY_CONTENT_DIR set to the validated read-only content path.');

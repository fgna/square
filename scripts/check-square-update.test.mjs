import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, findUpdates, versionFromStagingPair } from './check-square-update.mjs';

test('compares stable versions numerically', () => {
  assert.equal(compareVersions('v1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0', 'v1.0.0'), 0);
  assert.throws(() => compareVersions('1.0.0-beta', '1.0.0'));
});

test('lists only newer published stable releases in ascending order', () => {
  const releases = [
    { tag_name: 'v2.0.0', draft: true },
    { tag_name: 'v1.2.0', prerelease: true },
    { tag_name: 'v1.10.0' },
    { tag_name: 'v1.0.0' },
    { tag_name: 'v1.2.0' },
    { tag_name: 'v1.0.1-rc.1' },
    { tag_name: 'invalid' },
  ];
  assert.deepEqual(findUpdates('1.0.0', releases).map((r) => r.tag_name), ['v1.2.0', 'v1.10.0']);
  assert.deepEqual(findUpdates('2.0.0', releases), []);
  assert.throws(() => findUpdates('latest', releases));
  assert.throws(() => findUpdates('1.0.0', {}));
});

test('derives installed version only from a matching pinned release checkout', async (t) => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'square-version-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sha = 'a'.repeat(40);
  const pair = join(dir, 'pair.json');
  await writeFile(pair, JSON.stringify({ core: { checkout: dir, revision: sha } }));
  const git = (args) => args.includes('rev-parse') ? sha : 'v1.0.0\\n';
  assert.equal(await versionFromStagingPair(pair, git), 'v1.0.0');
  await assert.rejects(versionFromStagingPair(pair, (args) => args.includes('rev-parse') ? 'b'.repeat(40) : 'v1.0.0'), /does not match/);
  await assert.rejects(versionFromStagingPair(pair, (args) => args.includes('rev-parse') ? sha : 'v1.0.0\\nv1.1.0'), /exactly one/);
});

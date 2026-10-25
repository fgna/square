import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, findUpdates } from './check-square-update.mjs';

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

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('release history is tag-bounded, deterministic, and PR guarded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'square-release-history-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  const node = (...args) => execFileSync(process.execPath, [join(dir, 'release-history.mjs'), ...args], { cwd: dir, encoding: 'utf8' });
  const commit = (message) => { git('add', '.'); git('commit', '-m', message); };
  try {
    git('init');
    git('config', 'user.email', 'release-test@example.invalid');
    git('config', 'user.name', 'Release test');
    cpSync(resolve('scripts/release-history.mjs'), join(dir, 'release-history.mjs'));
    mkdirSync(join(dir, 'changes'));
    mkdirSync(join(dir, 'apps'));
    writeFileSync(join(dir, 'apps', 'example.txt'), 'baseline\n');
    commit('baseline');
    git('tag', 'v1.0.0');

    writeFileSync(join(dir, 'apps', 'example.txt'), 'updated\n');
    commit('runtime without entry');
    assert.throws(() => node('check-pr', 'v1.0.0'), /change entry|changes\/.*json|release entry/i);

    writeFileSync(join(dir, 'changes', 'feature.json'), JSON.stringify({
      title: 'New member experience', category: 'new', audience: 'members',
      description: 'Members can use the improved landing page.', pr: 42
    }));
    commit('add release entry');
    assert.match(node('check-pr', 'v1.0.0'), /passed/);
    const result = node('generate', 'v1.0.0', 'HEAD');
    assert.match(result, /New member experience/);
    assert.match(result, /#42/);
    assert.equal(node('generate', 'v1.0.0', 'HEAD'), result);

    git('tag', 'v1.1.0');
    writeFileSync(join(dir, 'apps', 'example.txt'), 'second update\\n');
    writeFileSync(join(dir, 'changes', 'feature.json'), JSON.stringify({
      title: 'Edited member experience', category: 'improved', audience: 'members',
      description: 'Existing entry updated but no new entry was added.', pr: 42
    }));
    commit('runtime change with edited old entry');
    assert.throws(() => node('check-pr', 'v1.1.0'));

    assert.doesNotMatch(node('generate', 'v1.1.0', 'HEAD'), /New member experience/);
    writeFileSync(join(dir, 'changes', 'fix.json'), JSON.stringify({
      title: 'Fix event RSVP', category: 'fixed', audience: 'members',
      description: 'RSVP submissions now succeed.', pr: 43
    }));
    commit('fix with entry');
    const next = node('generate', 'v1.1.0', 'HEAD');
    assert.match(next, /Fix event RSVP/);
    assert.doesNotMatch(next, /New member experience/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

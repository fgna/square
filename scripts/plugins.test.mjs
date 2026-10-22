import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collect, renderApiRegistry, renderMessages, renderWebRegistry, satisfies } from './plugins.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sample = join(repo, 'examples/plugins/hello-world');

/** A throwaway Core layout with the sample plugin next to it; mutate edits the plugin. */
function setup(mutate, { bundled = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'core-plugins-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '1.2.0' }));
  for (const app of ['api', 'web']) mkdirSync(join(root, 'apps', app, 'src', 'plugins'), { recursive: true });
  if (bundled) {
    // A built-in "notes" plugin whose navigation label is a Core message key.
    mkdirSync(join(root, 'apps/web/messages'), { recursive: true });
    for (const l of ['de', 'en']) writeFileSync(join(root, 'apps/web/messages', `${l}.json`), JSON.stringify({ nav: { notes: 'Notes' } }));
    const web = join(root, 'apps/web/src/plugins/bundled/notes');
    const api = join(root, 'apps/api/src/plugins/bundled/notes');
    mkdirSync(web, { recursive: true });
    mkdirSync(api, { recursive: true });
    writeFileSync(join(web, 'plugin.json'), JSON.stringify({ id: 'notes', name: 'Notes', version: '1.0.0', core: '^1.0.0', nav: [{ path: '', labelKey: 'nav.notes', icon: 'BookOpen', group: 'learning', order: 1 }] }));
    writeFileSync(join(web, 'index.tsx'), '');
    writeFileSync(join(api, 'index.ts'), '');
  }
  const plugin = join(root, 'plugins', 'hello-world');
  cpSync(sample, plugin, { recursive: true });
  mutate?.(plugin);
  const config = join(root, 'community.plugins.json');
  writeFileSync(config, JSON.stringify({ plugins: [{ path: 'plugins/hello-world' }] }));
  return { root, plugin, config };
}

// The CLI works on its own checkout, so tests run a copy inside the throwaway Core.
function syncIn(env) {
  mkdirSync(join(env.root, 'scripts'), { recursive: true });
  cpSync(join(repo, 'scripts/plugins.mjs'), join(env.root, 'scripts/plugins.mjs'));
  return spawnSync(process.execPath, [join(env.root, 'scripts/plugins.mjs'), '--config', env.config], { encoding: 'utf8' });
}

const editJson = (file, fn) => {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  fn(json);
  writeFileSync(file, JSON.stringify(json));
};

function expectFailure(mutate, message) {
  const env = setup(mutate);
  try {
    const result = syncIn(env);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, message);
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
}

test('installs the sample plugin into API and web', () => {
  const env = setup();
  try {
    const result = syncIn(env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Plugins active: hello-world/);

    const api = readFileSync(join(env.root, 'apps/api/src/plugins/registry.generated.ts'), 'utf8');
    assert.match(api, /import plugin0 from '\.\/installed\/hello-world';/);
    assert.match(api, /\{ id: 'hello-world', plugin: plugin0 \}/);
    const web = readFileSync(join(env.root, 'apps/web/src/plugins/registry.generated.ts'), 'utf8');
    assert.match(web, /"icon":"Sparkles","group":"more"/);
    const messages = JSON.parse(readFileSync(join(env.root, 'apps/web/src/plugins/messages.generated.json'), 'utf8'));
    assert.equal(messages.de['hello-world'].nav, 'Hallo Welt');
    assert.equal(messages.en['hello-world'].nav, 'Hello World');
    assert.ok(existsSync(join(env.root, 'apps/api/src/plugins/installed/hello-world/index.ts')));
    assert.ok(existsSync(join(env.root, 'apps/web/src/plugins/installed/hello-world/index.tsx')));
    // The plugin's own tests run with the app's tests.
    assert.ok(existsSync(join(env.root, 'apps/api/src/plugins/installed/hello-world/hello-world.spec.ts')));
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('removing a plugin from the config uninstalls it', () => {
  const env = setup();
  try {
    assert.equal(syncIn(env).status, 0);
    writeFileSync(env.config, JSON.stringify({ plugins: [] }));
    assert.equal(syncIn(env).status, 0);
    assert.ok(!existsSync(join(env.root, 'apps/web/src/plugins/installed/hello-world')));
    assert.equal(readFileSync(join(env.root, 'apps/api/src/plugins/registry.generated.ts'), 'utf8'), renderApiRegistry([]));
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('the committed registries are the ones for the default config (built-in plugins only)', () => {
  const plugins = collect({ root: repo, config: join(repo, 'no-such-config.json') });
  assert.ok(plugins.length > 0 && plugins.every((p) => p.source === 'bundled'));
  assert.equal(readFileSync(join(repo, 'apps/api/src/plugins/registry.generated.ts'), 'utf8'), renderApiRegistry(plugins));
  assert.equal(readFileSync(join(repo, 'apps/web/src/plugins/registry.generated.ts'), 'utf8'), renderWebRegistry(plugins));
  assert.equal(readFileSync(join(repo, 'apps/web/src/plugins/messages.generated.json'), 'utf8'), renderMessages(plugins));
});

test('built-in plugins are active by default, from their own folders', () => {
  const env = setup(undefined, { bundled: true });
  try {
    rmSync(env.config);
    const result = syncIn(env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Plugins active: notes \(built in\)/);
    assert.match(readFileSync(join(env.root, 'apps/api/src/plugins/registry.generated.ts'), 'utf8'), /import plugin0 from '\.\/bundled\/notes';/);
    const web = readFileSync(join(env.root, 'apps/web/src/plugins/registry.generated.ts'), 'utf8');
    assert.match(web, /"labelKey":"nav\.notes".*bundled: true/);
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('a built-in plugin can be disabled', () => {
  const env = setup(undefined, { bundled: true });
  try {
    writeFileSync(env.config, JSON.stringify({ disable: ['notes'] }));
    const result = syncIn(env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No plugins active/);
    assert.equal(readFileSync(join(env.root, 'apps/api/src/plugins/registry.generated.ts'), 'utf8'), renderApiRegistry([]));
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('a configured plugin with the same id replaces the built-in one', () => {
  const env = setup((p) => editJson(join(p, 'plugin.json'), (m) => (m.id = 'notes')), { bundled: true });
  try {
    const result = syncIn(env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Plugins active: notes$/m);
    assert.match(readFileSync(join(env.root, 'apps/api/src/plugins/registry.generated.ts'), 'utf8'), /'\.\/installed\/notes'/);
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('only built-in plugins can be disabled', () => {
  const env = setup(undefined, { bundled: true });
  try {
    writeFileSync(env.config, JSON.stringify({ disable: ['hello-world'] }));
    const result = syncIn(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not a built-in plugin/);
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('stops when the plugin needs another Core version', () => {
  expectFailure((p) => editJson(join(p, 'plugin.json'), (m) => (m.core = '^2.0.0')), /needs Core \^2\.0\.0, this Core is 1\.2\.0/);
});

test('rejects an invalid id', () => {
  expectFailure((p) => editJson(join(p, 'plugin.json'), (m) => (m.id = 'Hello_World')), /id "Hello_World"/);
});

test('rejects messages whose languages differ', () => {
  expectFailure((p) => editJson(join(p, 'messages/de.json'), (m) => delete m.error), /same keys/);
});

test('rejects navigation with an unknown icon, group or label', () => {
  expectFailure((p) => editJson(join(p, 'plugin.json'), (m) => (m.nav[0].icon = 'Rocket')), /icon "Rocket"/);
  expectFailure((p) => editJson(join(p, 'plugin.json'), (m) => (m.nav[0].group = 'admin')), /group "admin"/);
  expectFailure((p) => editJson(join(p, 'plugin.json'), (m) => (m.nav[0].labelKey = 'missing')), /label "missing"/);
});

test('requires type-only imports from the SDK', () => {
  expectFailure(
    (p) => writeFileSync(join(p, 'api/extra.ts'), "import { ApiPlugin } from '@community/plugin-sdk/api';\n"),
    /import type/,
  );
});

test('refuses symbolic links inside a plugin', () => {
  expectFailure((p) => symlinkSync('/etc/hosts', join(p, 'web/hosts')), /symbolic links/);
});

test('rejects a plugin listed twice', () => {
  const env = setup();
  try {
    writeFileSync(env.config, JSON.stringify({ plugins: [{ path: 'plugins/hello-world' }, { path: 'plugins/hello-world' }] }));
    const result = syncIn(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /listed twice/);
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('without a config nothing is installed', () => {
  const env = setup();
  try {
    rmSync(env.config);
    const result = syncIn(env);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No plugins active/);
  } finally {
    rmSync(env.root, { recursive: true, force: true });
  }
});

test('Core version ranges', () => {
  assert.ok(satisfies('1.4.2', '^1.0.0'));
  assert.ok(!satisfies('2.0.0', '^1.0.0'));
  assert.ok(!satisfies('0.3.0', '^0.2.0'));
  assert.ok(satisfies('1.4.9', '~1.4.0'));
  assert.ok(!satisfies('1.5.0', '~1.4.0'));
  assert.ok(satisfies('3.0.0', '>=1.0.0'));
  assert.ok(satisfies('1.0.0', '1.0.0'));
  assert.ok(!satisfies('1.0.1', '1.0.0'));
  assert.ok(satisfies('9.9.9', '*'));
  assert.throws(() => satisfies('1.0.0', '1.x'), /unsupported Core range/);
});

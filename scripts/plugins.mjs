#!/usr/bin/env node
// Plugin sync: installs the plugins listed in community.plugins.json into the
// API and the web app before they are built.
//
//   node scripts/plugins.mjs [--config <file>]
//
// The config (default: $COMMUNITY_PLUGINS_FILE, else community.plugins.json in
// the repository root) lists plugin folders. Without a config no plugin is
// installed, and the Core runs as it is.
//
// For each plugin the script checks plugin.json (id, Core version range,
// navigation) and its messages, copies web/ and api/ into
// apps/{web,api}/src/plugins/installed/<id>/ and writes the registries the Core
// reads. Plugins are trusted code chosen by the operator; nothing is loaded at
// runtime. Running it again with a plugin removed uninstalls that plugin.
//
// The Core also ships built-in plugins in apps/{web,api}/src/plugins/bundled/<id>/
// (plugin.json next to the web part). They are active unless the config lists
// them under "disable", or a configured plugin with the same id replaces them.
// Built-in plugins are part of the Core: their navigation labels are Core
// message keys, and the committed registries are those for the default config.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NAV_GROUPS = ['main', 'together', 'learning', 'live', 'more'];
// Keep in sync with NavIcon in packages/plugin-sdk and the icon map in the sidebar.
export const NAV_ICONS = [
  'BookOpen', 'BarChart3', 'Bot', 'Calendar', 'ClipboardList', 'Compass', 'Heart',
  'Lightbulb', 'ListChecks', 'MessageSquare', 'NotebookPen', 'Sparkles', 'Target', 'Trophy',
];
const LOCALES = ['de', 'en'];
const ID = /^[a-z][a-z0-9-]{1,39}$/;
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const NAV_PATH = /^$|^[a-z0-9-]+(\/[a-z0-9-]+)*$/;

class PluginError extends Error {}
const fail = (message) => {
  throw new PluginError(message);
};

function parseVersion(text, what) {
  const m = VERSION.exec(text ?? '');
  if (!m) fail(`${what}: "${text}" is not a version like 1.2.3`);
  return m.slice(1).map(Number);
}

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Supports "*", "1.2.3", ">=1.2.3", "~1.2.3" and "^1.2.3". */
export function satisfies(version, range) {
  const v = parseVersion(version, 'Core version');
  const r = String(range ?? '').trim();
  if (r === '*') return true;
  const m = /^(\^|~|>=)?(\d+\.\d+\.\d+)$/.exec(r);
  if (!m) fail(`unsupported Core range "${r}" (use *, 1.2.3, >=1.2.3, ~1.2.3 or ^1.2.3)`);
  const [op, base] = [m[1] ?? '', parseVersion(m[2], 'range')];
  if (compare(v, base) < 0) return false;
  if (op === '') return compare(v, base) === 0;
  if (op === '>=') return true;
  if (op === '~') return v[0] === base[0] && v[1] === base[1];
  // ^: no breaking change; below 1.0.0 the minor version counts as breaking.
  return base[0] > 0 ? v[0] === base[0] : v[0] === 0 && v[1] === base[1];
}

const readJson = (file, what) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail(`${what}: cannot read ${file}`);
  }
};

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** Lists files below dir; symlinks are refused so nothing outside the plugin is copied. */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) fail(`${full}: symbolic links are not allowed in plugins`);
    return stat.isDirectory() ? walk(full) : [full];
  });
}

// SDK imports must be type-only: the SDK has no runtime code.
const SDK_VALUE_IMPORT = /import\s+(?!type\b)[^;]*from\s+['"]@community\/plugin-sdk(\/[a-z]+)?['"]/;

function readManifest(dir, coreVersion) {
  if (!existsSync(join(dir, 'plugin.json'))) fail(`${dir}: plugin.json missing`);
  const manifest = readJson(join(dir, 'plugin.json'), dir);
  const { id } = manifest;
  if (!ID.test(id ?? '')) fail(`${dir}: id "${id}" must be 2-40 lower case letters, digits or dashes`);
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) fail(`${id}: name missing`);
  parseVersion(manifest.version, `${id}: version`);
  if (!satisfies(coreVersion, manifest.core)) {
    fail(`${id}: needs Core ${manifest.core}, this Core is ${coreVersion}`);
  }
  return manifest;
}

/** Checks navigation entries; `known` holds the message keys a label may use. */
function checkNav(id, manifest, hasWeb, known) {
  const nav = manifest.nav ?? [];
  if (!Array.isArray(nav)) fail(`${id}: nav must be a list`);
  if (nav.length && !hasWeb) fail(`${id}: navigation entries need web/index.tsx`);
  for (const entry of nav) {
    if (!NAV_PATH.test(entry.path ?? '')) fail(`${id}: nav path "${entry.path}" is invalid`);
    if (!NAV_GROUPS.includes(entry.group)) fail(`${id}: nav group "${entry.group}" is not one of ${NAV_GROUPS.join(', ')}`);
    if (!NAV_ICONS.includes(entry.icon)) fail(`${id}: nav icon "${entry.icon}" is not offered by the Core`);
    if (!known.has(entry.labelKey)) fail(`${id}: nav label "${entry.labelKey}" missing in messages`);
    if (entry.order !== undefined && !Number.isInteger(entry.order)) fail(`${id}: nav order must be a whole number`);
  }
  return nav.map(({ path, labelKey, icon, group, order }) => ({ path, labelKey, icon, group, ...(order !== undefined && { order }) }));
}

function loadPlugin(dir, coreVersion) {
  const manifest = readManifest(dir, coreVersion);
  const { id } = manifest;
  const hasWeb = existsSync(join(dir, 'web', 'index.tsx'));
  const hasApi = existsSync(join(dir, 'api', 'index.ts'));
  if (!hasWeb && !hasApi) fail(`${id}: needs web/index.tsx, api/index.ts or both`);

  const messages = {};
  for (const locale of LOCALES) {
    messages[locale] = readJson(join(dir, 'messages', `${locale}.json`), `${id}: messages`);
  }
  const keys = LOCALES.map((l) => flatKeys(messages[l]).sort().join('\n'));
  if (keys.some((k) => k !== keys[0])) fail(`${id}: messages/de.json and messages/en.json must have the same keys`);
  const nav = checkNav(id, manifest, hasWeb, new Set(keys[0].split('\n')));

  for (const part of ['web', 'api']) {
    if (!existsSync(join(dir, part))) continue;
    for (const file of walk(join(dir, part))) {
      if (/\.tsx?$/.test(file) && SDK_VALUE_IMPORT.test(readFileSync(file, 'utf8'))) {
        fail(`${relative(dir, file)}: import from @community/plugin-sdk with "import type"`);
      }
    }
  }

  return { id, source: 'installed', dir, hasWeb, hasApi, nav, messages };
}

/** Built-in plugins: plugin.json in apps/web/src/plugins/bundled/<id>/. */
function loadBundled(root, coreVersion) {
  const webBase = join(root, 'apps/web/src/plugins/bundled');
  if (!existsSync(webBase)) return [];
  const coreKeys = LOCALES.map((l) => new Set(flatKeys(readJson(join(root, 'apps/web/messages', `${l}.json`), 'Core messages'))));
  return readdirSync(webBase)
    .filter((name) => existsSync(join(webBase, name, 'plugin.json')))
    .sort()
    .map((name) => {
      const manifest = readManifest(join(webBase, name), coreVersion);
      const { id } = manifest;
      if (id !== name) fail(`${id}: built-in plugin folder must be named after its id`);
      const hasWeb = existsSync(join(webBase, id, 'index.tsx'));
      const hasApi = existsSync(join(root, 'apps/api/src/plugins/bundled', id, 'index.ts'));
      if (!hasWeb && !hasApi) fail(`${id}: needs index.tsx, an API part or both`);
      const known = new Set([...coreKeys[0]].filter((k) => coreKeys.every((set) => set.has(k))));
      return { id, source: 'bundled', hasWeb, hasApi, nav: checkNav(id, manifest, hasWeb, known), messages: null };
    });
}

const HEADER = '// Generated by scripts/plugins.mjs from community.plugins.json. Do not edit.\n';

export function renderApiRegistry(plugins) {
  const list = plugins.filter((p) => p.hasApi);
  return (
    HEADER +
    "import type { ApiPlugin } from '@community/plugin-sdk/api';\n" +
    list.map((p, i) => `import plugin${i} from './${p.source}/${p.id}';\n`).join('') +
    '\nexport const apiPlugins: { id: string; plugin: ApiPlugin }[] = [' +
    (list.length ? '\n' + list.map((p, i) => `  { id: '${p.id}', plugin: plugin${i} },\n`).join('') : '') +
    '];\n'
  );
}

export function renderWebRegistry(plugins) {
  const list = plugins.filter((p) => p.hasWeb);
  return (
    HEADER +
    "import type { PluginNavEntry } from '@community/plugin-sdk';\n" +
    "import type { WebPlugin } from '@community/plugin-sdk/web';\n" +
    list.map((p, i) => `import plugin${i} from './${p.source}/${p.id}';\n`).join('') +
    '\n// Built-in plugins use Core message keys for their navigation labels.\n' +
    'export const webPlugins: { id: string; nav: PluginNavEntry[]; plugin: WebPlugin; bundled?: true }[] = [' +
    (list.length
      ? '\n' + list.map((p, i) => `  { id: '${p.id}', nav: ${JSON.stringify(p.nav)}, plugin: plugin${i}${p.source === 'bundled' ? ', bundled: true' : ''} },\n`).join('')
      : '') +
    '];\n'
  );
}

/**
 * The instance's start page: "home" in the config names an active plugin with a
 * web part. Members land there after signing in, and on "/". Without it, the
 * Core dashboard stays the start page.
 */
export function readHome({ config }, plugins) {
  const settings = existsSync(config) ? readJson(config, 'config') : {};
  const home = settings.home;
  if (home === undefined) return null;
  if (typeof home !== 'string' || !plugins.some((p) => p.id === home && p.hasWeb)) {
    fail(`${config}: "home" must name an active plugin with a web part`);
  }
  return home;
}

export function renderHome(home) {
  return (
    HEADER +
    '// Kept apart from the registry: the middleware imports it without any plugin code.\n' +
    `export const HOME_PLUGIN: string | null = ${home ? `'${home}'` : 'null'};\n` +
    `export const HOME_PATH: string = '${home ? `/p/${home}` : '/dashboard'}';\n`
  );
}

export function renderMessages(plugins) {
  const own = plugins.filter((p) => p.messages);
  const out = Object.fromEntries(LOCALES.map((l) => [l, Object.fromEntries(own.map((p) => [p.id, p.messages[l]]))]));
  return JSON.stringify(out, null, 2) + '\n';
}

function writeIfChanged(file, content) {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return;
  writeFileSync(file, content);
}

/** The active plugins for a config: built-in ones (unless disabled or replaced), then configured ones. */
export function collect({ root, config }) {
  const coreVersion = readJson(join(root, 'package.json'), 'Core').version;
  const settings = existsSync(config) ? readJson(config, 'config') : {};
  const entries = settings.plugins ?? [];
  const disabled = settings.disable ?? [];
  if (!Array.isArray(entries)) fail(`${config}: "plugins" must be a list`);
  if (!Array.isArray(disabled)) fail(`${config}: "disable" must be a list`);

  const installed = entries.map((entry) => {
    if (typeof entry?.path !== 'string') fail(`${config}: every plugin needs a "path"`);
    return loadPlugin(resolve(dirname(config), entry.path), coreVersion);
  });
  const ids = installed.map((p) => p.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) fail(`plugin "${dup}" is listed twice`);

  const bundled = loadBundled(root, coreVersion);
  const unknown = disabled.find((id) => !bundled.some((b) => b.id === id));
  if (unknown) fail(`"${unknown}" in "disable" is not a built-in plugin`);
  return [...bundled.filter((b) => !disabled.includes(b.id) && !ids.includes(b.id)), ...installed];
}

export function sync({ root, config }) {
  const plugins = collect({ root, config });
  const home = readHome({ config }, plugins);
  const installed = plugins.filter((p) => p.source === 'installed');

  for (const app of ['api', 'web']) {
    const target = join(root, 'apps', app, 'src', 'plugins', 'installed');
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const p of installed) {
      if (existsSync(join(p.dir, app))) cpSync(join(p.dir, app), join(target, p.id), { recursive: true });
    }
  }
  writeIfChanged(join(root, 'apps/api/src/plugins/registry.generated.ts'), renderApiRegistry(plugins));
  writeIfChanged(join(root, 'apps/web/src/plugins/registry.generated.ts'), renderWebRegistry(plugins));
  writeIfChanged(join(root, 'apps/web/src/plugins/messages.generated.json'), renderMessages(plugins));
  writeIfChanged(join(root, 'apps/web/src/plugins/home.generated.ts'), renderHome(home));
  return plugins;
}

// Real paths, because on macOS the temp folder /var is a link to /private/var.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const i = process.argv.indexOf('--config');
  const config = resolve(i > 0 ? process.argv[i + 1] : process.env.COMMUNITY_PLUGINS_FILE || join(root, 'community.plugins.json'));
  try {
    const plugins = sync({ root, config });
    const names = plugins.map((p) => (p.source === 'bundled' ? `${p.id} (built in)` : p.id));
    console.log(names.length ? `Plugins active: ${names.join(', ')}` : 'No plugins active.');
  } catch (err) {
    if (!(err instanceof PluginError)) throw err;
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

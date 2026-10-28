# Plugins

An instance runs on a fixed Core version and adds its own features in two ways:

- **Content packs** (`COMMUNITY_CONTENT_DIR`): content and rules as data.
- **Plugins**: own code for modules with their own pages or logic.

An instance never changes Core code. If a plugin needs something the Core does
not offer, the missing interface belongs in the Core.

## How plugins are installed

Plugins are trusted code chosen by the operator. They are installed at build
time, not loaded at runtime. There is no marketplace and no sandbox.

1. `community.plugins.json` lists the plugin folders. The default location is the
   repository root; `COMMUNITY_PLUGINS_FILE` can point elsewhere.

   ```json
   { "plugins": [{ "path": "../my-instance/plugins/journal-plus" }] }
   ```

2. `pnpm plugins:sync` checks every plugin and copies it into the apps:
   - `web/` → `apps/web/src/plugins/installed/<id>/`
   - `api/` → `apps/api/src/plugins/installed/<id>/`
   - `messages/` → `apps/web/src/plugins/messages.generated.json`

   It also writes the registries `apps/{api,web}/src/plugins/registry.generated.ts`.

3. The apps are built as usual. Plugin code is compiled and type-checked together
   with the Core, so incompatibilities stop the build instead of failing in
   production.

Removing a plugin from the config and syncing again uninstalls it: no navigation
entry, its pages answer 404, and its API routes are not registered.

## Built-in plugins

The Core ships some modules as plugins of its own, in
`apps/web/src/plugins/bundled/<id>/` (with `plugin.json`) and
`apps/api/src/plugins/bundled/<id>/`. They are active by default; the committed
registries are those for this default, so the Core builds without running the
sync. An instance can switch one off, or replace it with its own plugin of the
same id:

```json
{ "disable": ["journal"] }
```

```json
{ "plugins": [{ "path": "../my-instance/plugins/journal" }] }
```

Built-in plugins are part of the Core: they may use Core internals, and their
navigation labels are Core message keys (e.g. `nav.journal`).

| Plugin | Member page | API | Notes |
|---|---|---|---|
| `journal` | `/p/journal` (`/journal` redirects) | `/api/p/journal` | Entries stay in the Core tables; the method comes from the content pack. The admin page for prompts is still at `/admin/journal-prompts`. |

Examples:

- `examples/plugins/hello-world`: page, navigation entry and API route.
- `examples/plugins/simple-journal`: replaces the built-in journal (same id
  `journal`) using only the SDK: one note a day through `ctx.data.journal`, the
  prompt of the day from `ctx.contentPack`.

```bash
pnpm plugins:sync --config examples/plugins/community.plugins.json
pnpm plugins:sync --config examples/plugins/replace-journal.plugins.json
pnpm plugins:sync   # back to the default
```

A replacement journal stores its own content shape in the same entries; when
an instance switches journals, existing entries keep the shape of the previous
one. The admin page `/admin/journal-prompts` belongs to the built-in journal
and does not work with a replacement yet.

## Plugin layout

```
plugin.json          id, name, version, supported Core versions, navigation
messages/de.json     texts, available as plugin.<id>.* (both languages, same keys)
messages/en.json
web/index.tsx        default export: WebPlugin (optional)
api/index.ts         default export: ApiPlugin (optional)
```

Tests next to the code (`*.spec.ts`, `*.spec.tsx`) are copied as well and run
with the app's tests.

`plugin.json`:

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "core": "^1.0.0",
  "nav": [{ "path": "", "labelKey": "nav", "icon": "Sparkles", "group": "more", "order": 0 }]
}
```

- `id`: 2–40 lower case letters, digits or dashes; also the URL segment.
- `core`: `*`, `1.2.3`, `>=1.2.3`, `~1.2.3` or `^1.2.3`, checked against the Core's
  `package.json` version.
- `nav`: `group` is one of `main`, `together`, `learning`, `live`, `more`; `icon` is
  one of the icons listed in `NavIcon`; `order` is the position in the group
  (default: after the Core's entries).

## Contract: `@community/plugin-sdk`

`packages/plugin-sdk` holds types only, and plugins import from it with
`import type`. Whatever a plugin needs at runtime, the Core hands to it. Only
what the SDK declares is part of the contract; plugins must not import Core
internals such as `@/lib/…`.

**Web** (`WebPlugin`): `Page` is rendered for every path below `/p/<id>` in the
member area, and in the installed app (PWA). It receives the path segments and
an API client limited to `/api/p/<id>/…`. Texts come from `useTranslations('plugin.<id>')`.

**API** (`ApiPlugin`): `register(ctx)` returns controllers and providers, which
the Core mounts under `/api/p/<id>`. The global guards apply as for Core routes:
members must be signed in, `ctx.Roles('ADMIN')` restricts a route,
`ctx.CurrentUser()` gives the signed-in member. Plugins import NestJS decorators
from `@nestjs/common` themselves.

**Data and content pack** (usable in request handlers, not during `register`):

- `ctx.data.journal`: members' journal entries, one per member and day, in the
  Core's `JournalEntry` table, so account deletion and data export cover them.
  `list`, `get`, `save`, `remove`, `dates`; days are `YYYY-MM-DD`. Only the
  active journal plugin should write here.
- `ctx.contentPack`: `source()` (`pack` or `legacy`), `journalMethod()` and
  `journalTexts(locale)` from the instance's content pack, checked once and
  pinned for the lifetime of the process.

The built-in journal uses the same services, so the Core's own journal and a
replacement see the same data.

**Runtime-neutral helpers**: besides the types, the SDK ships small pure
modules that any plugin may use. They know nothing about a plugin's subject.

- `@community/plugin-sdk/tasks`: validation and grading of numeric and choice
  tasks; answer keys stay on the server.
- `@community/plugin-sdk/adaptive`: adaptive practice. `replayLadder` replays
  judged trials over a plugin's ordered levels (move up after stable
  independent success, step back one level after repeated failure),
  `reviewQueue` brings failed items back with growing spacing,
  `planNextTrial` mixes practice, review and an easier "confidence" trial after
  a failure streak, and `personalPace`/`isBrisk` compare a learner only with
  their own typical response time (never show it as a countdown).

The Core does not hand these modules to plugins at runtime yet, so a plugin
that needs one copies the file unchanged (with its `.d.ts`) and checks it
against the SDK version it targets. `pnpm test:sdk` runs their tests.

## Not part of the first step

Dashboard tiles, admin pages, a generic data store for plugins (`PluginRecord`),
assessment data and further extension points follow when a real plugin needs
them.

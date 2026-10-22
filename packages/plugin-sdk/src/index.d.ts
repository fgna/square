/**
 * Contract between the Community Core and its plugins.
 *
 * Plugins are trusted code that the operator of an instance lists in
 * community.plugins.json. `pnpm plugins:sync` copies them into the API and the
 * web app before the build, so they are compiled and checked together with the
 * Core. Nothing is loaded at runtime.
 *
 * The SDK is types only: whatever a plugin needs at runtime (decorators,
 * a scoped API client) the Core hands to it. Only what is declared here is
 * part of the contract; plugins must not import Core internals.
 */

/** Sidebar groups a plugin can add entries to. */
export type NavGroup = 'main' | 'together' | 'learning' | 'live' | 'more';

/** Icons the Core offers for plugin navigation entries. */
export type NavIcon =
  | 'BookOpen'
  | 'BarChart3'
  | 'Bot'
  | 'Calendar'
  | 'ClipboardList'
  | 'Compass'
  | 'Heart'
  | 'Lightbulb'
  | 'ListChecks'
  | 'MessageSquare'
  | 'NotebookPen'
  | 'Sparkles'
  | 'Target'
  | 'Trophy';

export interface PluginNavEntry {
  /** Path below /p/<plugin id>, '' for the plugin's start page. */
  path: string;
  /** Message key below plugin.<plugin id>. */
  labelKey: string;
  icon: NavIcon;
  group: NavGroup;
  /** Position within the group; entries without it come after the Core's. */
  order?: number;
}

/** plugin.json */
export interface PluginManifest {
  /** Lower case letters, digits and dashes; also the URL segment /p/<id>. */
  id: string;
  name: string;
  version: string;
  /** Supported Core versions, e.g. "^1.0.0". The build stops when it does not match. */
  core: string;
  nav?: PluginNavEntry[];
}

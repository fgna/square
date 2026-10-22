/**
 * Web side of a plugin: web/index.tsx default-exports a WebPlugin.
 *
 * The Core renders `Page` for every path below /p/<plugin id> inside the member
 * area, so it appears in the installed web app (PWA) as well. Texts come from
 * the plugin's messages under plugin.<plugin id> (next-intl).
 */
/** API client limited to the plugin's own routes (/api/p/<plugin id>/…). */
export interface PluginApiClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
}

export interface PluginPageProps {
  /** Path segments below /p/<plugin id>; empty on the start page. */
  path: string[];
  api: PluginApiClient;
}

export interface WebPlugin {
  /** A React component, e.g. `function Page({ path, api }: PluginPageProps) { … }`. */
  Page: (props: PluginPageProps) => unknown;
}

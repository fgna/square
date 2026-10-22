import type { NavGroup, NavIcon } from '@community/plugin-sdk';
import type { PluginApiClient } from '@community/plugin-sdk/web';
import apiClient from '@/lib/api-client';
import { webPlugins } from './registry.generated';

/**
 * Installed plugins as written by scripts/plugins.mjs. The helpers take the
 * list as a parameter so tests can pass their own.
 */
export type InstalledWebPlugins = typeof webPlugins;

export function findWebPlugin(id: string, plugins: InstalledWebPlugins = webPlugins) {
  return plugins.find((p) => p.id === id);
}

export interface PluginNavItem {
  href: string;
  /** Full message key: plugin.<id>.<labelKey>, or a Core key for built-in plugins. */
  messageKey: string;
  icon: NavIcon;
  group: NavGroup;
  order?: number;
}

export function pluginNavItems(plugins: InstalledWebPlugins = webPlugins): PluginNavItem[] {
  return plugins.flatMap(({ id, nav, bundled }) =>
    nav.map(({ path, labelKey, icon, group, order }) => ({
      href: path ? `/p/${id}/${path}` : `/p/${id}`,
      messageKey: bundled ? labelKey : `plugin.${id}.${labelKey}`,
      icon,
      group,
      order,
    })),
  );
}

/** API client for /api/p/<id>/…; a plugin cannot reach other routes through it. */
export function pluginApiClient(id: string): PluginApiClient {
  const url = (path: string) => {
    const clean = path.replace(/^\/+/, '');
    if (clean.split(/[/?#]/).some((s) => s === '..' || s === '.')) throw new Error(`Invalid plugin API path: ${path}`);
    return `/p/${id}/${clean}`;
  };
  return {
    get: (path) => apiClient.get(url(path)).then((r) => r.data),
    post: (path, body) => apiClient.post(url(path), body).then((r) => r.data),
    put: (path, body) => apiClient.put(url(path), body).then((r) => r.data),
    delete: (path) => apiClient.delete(url(path)).then((r) => r.data),
  };
}

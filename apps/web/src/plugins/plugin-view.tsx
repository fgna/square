'use client';

import { useMemo, type ComponentType } from 'react';
import { notFound } from 'next/navigation';
import type { PluginPageProps } from '@community/plugin-sdk/web';
import { findWebPlugin, pluginApiClient, type InstalledWebPlugins } from '@/plugins';

/** Renders an installed plugin's page; unknown or uninstalled plugins are a 404. */
export function PluginView({ id, path, plugins }: { id: string; path: string[]; plugins?: InstalledWebPlugins }) {
  const installed = findWebPlugin(id, plugins);
  const api = useMemo(() => pluginApiClient(id), [id]);
  if (!installed) notFound();
  const Page = installed.plugin.Page as ComponentType<PluginPageProps>;
  return <Page path={path} api={api} />;
}

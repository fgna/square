'use client';

import { useParams } from 'next/navigation';
import { PluginView } from '@/plugins/plugin-view';

/** Every path below /p/<plugin id> belongs to that plugin (see docs/PLUGINS.md). */
export default function PluginPage() {
  const { plugin, path } = useParams<{ plugin: string; path?: string[] }>();
  return <PluginView id={plugin} path={path ?? []} />;
}

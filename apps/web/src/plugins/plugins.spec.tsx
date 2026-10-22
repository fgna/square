import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PluginPageProps } from '@community/plugin-sdk/web';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
vi.mock('next/navigation', () => ({ notFound, usePathname: () => '/p/sample/x' }));

import { findWebPlugin, pluginApiClient, pluginNavItems, type InstalledWebPlugins } from './index';
import { PluginView } from './plugin-view';
import { navGroups, withPluginEntries } from '@/components/layout/sidebar';
import journal from './bundled/journal';
import journalManifest from './bundled/journal/plugin.json';

function SamplePage({ path }: PluginPageProps) {
  return <p>sample page {path.join('/') || 'start'}</p>;
}

const plugins: InstalledWebPlugins = [
  {
    id: 'sample',
    nav: [
      { path: '', labelKey: 'nav', icon: 'Sparkles', group: 'more' },
      { path: 'stats', labelKey: 'stats', icon: 'BarChart3', group: 'learning', order: 0 },
    ],
    plugin: { Page: SamplePage },
  },
];

describe('plugin pages', () => {
  it('renders the installed plugin with the path below /p/<id>', () => {
    render(<PluginView id="sample" path={['x', 'y']} plugins={plugins} />);
    expect(screen.getByText('sample page x/y')).toBeInTheDocument();
  });

  it('answers 404 for a plugin that is not installed', () => {
    expect(() => render(<PluginView id="other" path={[]} plugins={plugins} />)).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('finds nothing when no plugin is installed', () => {
    expect(findWebPlugin('sample', [])).toBeUndefined();
  });
});

describe('plugin navigation', () => {
  it('links entries to /p/<id> with their message key', () => {
    expect(pluginNavItems(plugins)).toEqual([
      { href: '/p/sample', messageKey: 'plugin.sample.nav', icon: 'Sparkles', group: 'more', order: undefined },
      { href: '/p/sample/stats', messageKey: 'plugin.sample.stats', icon: 'BarChart3', group: 'learning', order: 0 },
    ]);
  });

  it('places entries in their group, by order or after the Core entries', () => {
    const groups = withPluginEntries(
      [
        { id: 'learning', items: [{ href: '/journal', labelKey: 'journal', icon: () => null }] },
        { id: 'more', items: [{ href: '/explore', labelKey: 'explore', icon: () => null }] },
      ] as never,
      pluginNavItems(plugins),
    );
    expect(groups[0].items.map((i) => i.href)).toEqual(['/p/sample/stats', '/journal']);
    expect(groups[1].items.map((i) => i.href)).toEqual(['/explore', '/p/sample']);
    expect(groups[1].items[1]).toMatchObject({ labelKey: 'plugin.sample.nav', plugin: true });
  });
});

describe('built-in plugins', () => {
  it('keep the journal where it was in the sidebar, between assessment and courses', () => {
    const builtIn = [{ id: 'journal', nav: journalManifest.nav as never, plugin: journal, bundled: true as const }];
    const learning = withPluginEntries(navGroups, pluginNavItems(builtIn)).find((g) => g.id === 'learning')!;
    expect(learning.items.map((i) => i.href)).toEqual(['/assessment', '/p/journal', '/courses']);
    expect(learning.items[1]).toMatchObject({ labelKey: 'nav.journal', plugin: true });
  });
});

describe('plugin API client', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: { ok: true } });
    api.post.mockReset().mockResolvedValue({ data: { id: 1 } });
  });

  it('keeps requests below /p/<id> and returns the data', async () => {
    const client = pluginApiClient('sample');
    expect(await client.get('/greeting')).toEqual({ ok: true });
    expect(api.get).toHaveBeenCalledWith('/p/sample/greeting');
    expect(await client.post('items', { a: 1 })).toEqual({ id: 1 });
    expect(api.post).toHaveBeenCalledWith('/p/sample/items', { a: 1 });
  });

  it('refuses paths that leave the plugin', () => {
    expect(() => pluginApiClient('sample').get('../admin/users')).toThrow('Invalid plugin API path');
  });
});

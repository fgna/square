import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Golden test: renders the journal as a member sees it (legacy form and pack
 * form), fills it in, saves and deletes, and compares the page and the API
 * calls with __golden__/journal-web.txt. Moving the journal must not change
 * that file; only BASE may change with the route. Regenerate deliberately
 * with `vitest -u`.
 */
const BASE = '/p/journal';
const NOW = new Date('2026-10-21T10:00:00.000Z');
const PACK = JSON.parse(readFileSync(resolve(__dirname, '../../../../../../examples/neutral-method-pack/journal/definition.json'), 'utf8'));

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

import { PluginView } from '@/plugins/plugin-view';
import journal from './index';
import manifest from './plugin.json';

// The built-in journal itself, whether or not an instance replaced it.
const plugins = [{ id: 'journal', nav: manifest.nav as never, plugin: journal, bundled: true as const }];

const notFound = () => Promise.reject(Object.assign(new Error('Not found'), { response: { status: 404 } }));
const prompts = [{ id: 'p1', text: 'What went well?', category: 'Evening', color: '#8b5cf6' }];

function routes(mode: 'legacy' | 'pack') {
  const get: Record<string, () => unknown> = {
    '/method': () => (mode === 'pack' ? { source: 'pack', version: PACK.version, fields: PACK.fields } : { source: 'legacy', version: null, fields: [] }),
    '/prompts': () => prompts,
    '': () => [{ id: 'e1', date: '2026-10-20T00:00:00.000Z', content: { thoughts: 'yesterday' }, moods: [] }],
    '/stats': () => ({ currentStreak: 2, longestStreak: 4, totalEntries: 9, last30DaysCount: 5, entriesByDate: { '2026-10-20': true } }),
  };
  return get;
}

/** Answers API calls below BASE and keeps a readable log of them. */
function serve(mode: 'legacy' | 'pack', log: string[]) {
  const table = routes(mode);
  const rel = (url: string) => {
    if (!url.startsWith(BASE)) throw new Error(`unexpected API call ${url}`);
    return url.slice(BASE.length);
  };
  api.get.mockReset().mockImplementation((url: string, config?: { params?: unknown }) => {
    const path = rel(url);
    log.push(`GET <base>${path}${config?.params ? ' ' + JSON.stringify(config.params) : ''}`);
    if (table[path]) return Promise.resolve({ data: table[path]() });
    return notFound();
  });
  api.put.mockReset().mockImplementation((url: string, body: unknown) => {
    log.push(`PUT <base>${rel(url)} ${JSON.stringify(body)}`);
    return Promise.resolve({ data: { id: 'e-new', ...(body as object) } });
  });
  api.delete.mockReset().mockImplementation((url: string) => {
    log.push(`DELETE <base>${rel(url)}`);
    return Promise.resolve({ data: { message: 'Journal entry deleted' } });
  });
}

function renderJournal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PluginView id="journal" path={[]} plugins={plugins} />
    </QueryClientProvider>,
  );
}

/** One line per element with its text, so the record shows structure and wording, not class names. */
function outline(root: Element): string {
  const lines: string[] = [];
  const walk = (el: Element, depth: number) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent!.trim()).filter(Boolean).join(' ');
    const attrs = ['role', 'aria-label', 'placeholder', 'type', 'value', 'disabled']
      .map((a) => (el.hasAttribute(a) ? `${a}=${JSON.stringify(a === 'value' ? (el as HTMLInputElement).value : el.getAttribute(a))}` : ''))
      .filter(Boolean)
      .join(' ');
    if (own || attrs || ['BUTTON', 'INPUT', 'TEXTAREA', 'H1', 'H2', 'H3', 'LABEL'].includes(el.tagName)) {
      lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${attrs ? ' ' + attrs : ''}>${own ? ' ' + own : ''}`);
    }
    [...el.children].forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return lines.join('\n');
}

describe('journal web golden record', () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows and saves the journal as recorded', async () => {
    const out: string[] = [];
    const user = userEvent.setup();

    // Legacy form
    const legacyLog: string[] = [];
    serve('legacy', legacyLog);
    const legacy = renderJournal();
    await screen.findByText('What went well?');
    await waitFor(() => expect(legacyLog.some((l) => l.includes('/stats'))).toBe(true));
    out.push('## legacy: loaded', outline(legacy.container));
    await user.type(screen.getByPlaceholderText("What's on your mind today?"), 'A calm day');
    await user.click(screen.getByRole('button', { name: /Grateful/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(legacyLog.some((l) => l.startsWith('PUT'))).toBe(true));
    out.push('## legacy: calls', ...legacyLog);
    legacy.unmount();

    // Pack form
    const packLog: string[] = [];
    serve('pack', packLog);
    const pack = renderJournal();
    await screen.findByLabelText(PACK.fields[0].label);
    out.push('## pack: loaded', outline(pack.container));
    await user.type(screen.getByLabelText(PACK.fields[0].label), 'Pack notes');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('status');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(packLog.some((l) => l.startsWith('DELETE'))).toBe(true));
    out.push('## pack: calls', ...packLog);

    await expect(out.join('\n') + '\n').toMatchFileSnapshot('./__golden__/journal-web.txt');
  });
});

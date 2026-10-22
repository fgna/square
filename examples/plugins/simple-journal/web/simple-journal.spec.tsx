import { describe, it, expect, vi } from 'vitest';
import type { ComponentType } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PluginApiClient, PluginPageProps } from '@community/plugin-sdk/web';
import simpleJournal from './index';

const Page = simpleJournal.Page as ComponentType<PluginPageProps>;

function api() {
  const get = vi.fn((path: string): Promise<unknown> =>
    Promise.resolve(path.startsWith('today') ? { date: '2026-10-21', text: '', prompt: 'What went well?' } : [{ date: '2026-10-20', text: 'Yesterday' }]),
  );
  const put = vi.fn().mockResolvedValue({ date: '2026-10-21', text: 'A good day' });
  const client = { get, put, post: vi.fn(), delete: vi.fn() } as unknown as PluginApiClient;
  return { client, get, put };
}

describe('simple-journal plugin page', () => {
  it('shows the prompt and earlier entries and saves today\'s note through its own API', async () => {
    const { client, get, put } = api();
    render(<Page path={[]} api={client} />);

    expect(await screen.findByText('What went well?')).toBeInTheDocument();
    expect(await screen.findByText('Yesterday')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('today?locale=en');

    await userEvent.type(screen.getByLabelText('What is on your mind today?'), 'A good day');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(put).toHaveBeenCalledWith('today', { text: 'A good day' });
  });
});

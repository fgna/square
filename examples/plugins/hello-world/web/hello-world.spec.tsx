import { describe, it, expect, vi } from 'vitest';
import type { ComponentType } from 'react';
import { render, screen } from '@testing-library/react';
import type { PluginApiClient, PluginPageProps } from '@community/plugin-sdk/web';
import helloWorld from './index';

const Page = helloWorld.Page as ComponentType<PluginPageProps>;

function api(get: PluginApiClient['get']): PluginApiClient {
  return { get, post: vi.fn(), put: vi.fn(), delete: vi.fn() };
}

describe('hello-world plugin page', () => {
  it('greets the member with the name from its API route', async () => {
    const get = vi.fn().mockResolvedValue({ name: 'Alex' });
    render(<Page path={[]} api={api(get)} />);

    expect(await screen.findByText('Hello, Alex!')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('greeting');
  });

  it('says so when the greeting cannot be loaded', async () => {
    render(<Page path={[]} api={api(vi.fn().mockRejectedValue(new Error('down')))} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The greeting could not be loaded.');
  });
});

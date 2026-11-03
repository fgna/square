import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthFrame } from './auth-frame';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));
vi.mock('@/plugins/home.generated', () => ({ HOME_PLUGIN: null }));

describe('AuthFrame', () => {
  it('shows the platform name from Admin → Settings on the sign-in pages', async () => {
    api.get.mockResolvedValue({ data: { platformName: 'GrowthLeaders', logoUrl: null, allowSignups: false } });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthFrame><p>form</p></AuthFrame>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'GrowthLeaders' })).toBeTruthy();
    expect(screen.queryByText('Community Platform')).toBeNull();
  });
});

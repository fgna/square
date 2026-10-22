import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

const params = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => params.value }));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ register: vi.fn(), registerLoading: false, registerError: null }),
}));
vi.mock('@/components/auth/social-buttons', () => ({ SocialButtons: () => null }));

function renderPage(search: string, allowSignups: boolean) {
  params.value = new URLSearchParams(search);
  api.get.mockResolvedValue({ data: { platformName: 'Community', logoUrl: null, allowSignups } });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RegisterPage />
    </QueryClientProvider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => api.get.mockReset());

  it('shows a notice instead of the form when sign-ups are off and there is no invitation', async () => {
    renderPage('', false);

    expect(await screen.findByText('Invitation only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
  });

  it('shows the form for invited people even when sign-ups are off', async () => {
    renderPage('invite=abc', false);

    expect(await screen.findByText("You've been invited to join. Complete your registration below.")).toBeInTheDocument();
    expect(screen.queryByText('Invitation only')).not.toBeInTheDocument();
  });

  it('shows the form when sign-ups are open', async () => {
    renderPage('', true);

    expect(await screen.findByLabelText('Full name')).toBeInTheDocument();
    expect(screen.queryByText('Invitation only')).not.toBeInTheDocument();
  });
});

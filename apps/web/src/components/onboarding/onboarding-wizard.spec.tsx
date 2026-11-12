import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingWizard } from './onboarding-wizard';

const mock = vi.hoisted(() => ({
  profile: {
    id: 'member-1',
    name: 'Old name',
    bio: 'Old biography',
    avatarUrl: '',
    onboardingCompleted: false,
  },
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('@/hooks/use-members', () => ({
  useMe: () => ({ data: mock.profile, isLoading: false }),
}));
vi.mock('@/hooks/use-categories', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('@/hooks/use-interests', () => ({
  useUpdateInterests: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-welcome-video', () => ({
  useWelcomeVideo: () => ({ data: null }),
}));
vi.mock('@/lib/api-client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { onboardingMode: 'OPTIONAL' } }),
    post: mock.post,
    patch: mock.patch,
  },
}));

describe('optional onboarding resume', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mock.post.mockReset();
    mock.patch.mockReset();
    mock.profile = {
      id: 'member-1',
      name: 'Old name',
      bio: 'Old biography',
      avatarUrl: '',
      onboardingCompleted: false,
    };
  });

  it('refreshes profile inputs after a member edits settings while the tour is dismissed', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = () => (
      <QueryClientProvider client={client}>
        <OnboardingWizard />
      </QueryClientProvider>
    );
    const { rerender } = render(view());
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Get Started' })).toBeNull());
    expect(mock.post).not.toHaveBeenCalled();
    mock.profile = { ...mock.profile, name: 'Updated name', bio: 'Updated biography' };
    rerender(view());
    act(() => window.dispatchEvent(new Event('square:resume-onboarding')));
    fireEvent.click(await screen.findByRole('button', { name: 'Get Started' }));
    expect(await screen.findByLabelText('Name')).toHaveValue('Updated name');
    expect(screen.getByLabelText('Bio')).toHaveValue('Updated biography');
    expect(mock.patch).not.toHaveBeenCalled();
  });
});

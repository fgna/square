import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePost } from './create-post';

const auth = vi.hoisted(() => ({ user: { id: 'a1', name: 'Peter', role: 'ADMIN' } }));
const create = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/use-feed', () => ({ useCreatePost: () => ({ mutateAsync: create, isPending: false }) }));
vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn() } }));
vi.mock('./rich-text-editor', () => ({
  RichTextEditor: ({ onChange }: { onChange: (html: string) => void }) => (
    <textarea aria-label="Post text" onChange={(e) => onChange(`<p>${e.target.value}</p>`)} />
  ),
}));
vi.mock('./post-attachments-picker', () => ({ PostAttachmentsPicker: () => null }));

window.matchMedia ??= ((query: string) =>
  ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);

function renderComposer() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreatePost initialFocused />
    </QueryClientProvider>,
  );
}

describe('Scheduling a post', () => {
  beforeEach(() => { create.mockReset(); create.mockResolvedValue({ id: 'p1' }); auth.user.role = 'ADMIN'; });

  it('sends the chosen time and says "Schedule" instead of posting now', async () => {
    renderComposer();
    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'Monday Motivator' } });
    fireEvent.change(screen.getByLabelText('Publish later'), { target: { value: '2099-11-02T06:00' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Schedule/ }).at(-1)!);
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].publishAt).toBe(new Date('2099-11-02T06:00').toISOString());
  });

  it('refuses a time in the past', async () => {
    renderComposer();
    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'Too late' } });
    fireEvent.change(screen.getByLabelText('Publish later'), { target: { value: '2020-01-01T06:00' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Schedule/ }).at(-1)!);
    expect(await screen.findByText('Choose a time in the future.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('is not offered to members', () => {
    auth.user.role = 'MEMBER';
    renderComposer();
    expect(screen.queryByLabelText('Publish later')).toBeNull();
  });
});

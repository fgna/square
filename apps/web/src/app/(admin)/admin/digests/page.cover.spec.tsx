import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDigestsPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

const photo = {
  id: 'p1', thumbUrl: 'https://images.unsplash.com/t1', url: 'https://images.unsplash.com/p1',
  credit: { name: 'Jane Doe', url: 'https://unsplash.com/@jane?utm_source=square&utm_medium=referral', source: 'unsplash' },
  downloadLocation: 'https://api.unsplash.com/photos/p1/download', alt: 'Team',
};
const template = {
  id: 't1', name: 'Woche', subject: 'Deine Woche', headerHtml: '', footerHtml: '', sections: ['new_posts'],
  accentColor: '#c5a880', logoUrl: '/uploads/uploads/u1/logo.png', coverUrl: null, coverCredit: null,
  isActive: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

describe('Digest template cover', () => {
  it('saves an Unsplash cover with its credit and keeps the uploaded logo', async () => {
    api.get.mockImplementation(async (url: string) => ({
      data: url === '/digest-templates' ? [template]
        : url === '/digest-templates/covers/status' ? { unsplash: true }
        : url === '/digest-templates/covers/search' ? [photo]
        : url === '/digest-templates/schedule' ? { daily: { hour: 7, minute: 0 }, weekly: { day: 1, hour: 7, minute: 0 }, timeZone: 'Europe/Berlin' }
        : {},
    }));
    api.patch.mockResolvedValue({ data: template });
    api.post.mockResolvedValue({ data: { ok: true } });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminDigestsPage />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const input = await within(dialog).findByPlaceholderText(/Unsplash/);
    fireEvent.change(input, { target: { value: 'team' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(await within(dialog).findByTitle('Jane Doe'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][0]).toBe('/digest-templates/t1');
    expect(api.patch.mock.calls[0][1]).toMatchObject({
      logoUrl: '/uploads/uploads/u1/logo.png', coverUrl: photo.url, coverCredit: photo.credit,
    });
  });
});

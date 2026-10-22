import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordingsAdminDialog } from './recordings-admin-dialog';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

function renderDialog() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordingsAdminDialog event={{ id: 'e1', title: 'Netzwerktreffen' }} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('RecordingsAdminDialog', () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) =>
      Promise.resolve(
        url === '/events/recordings/retention'
          ? { data: { days: 365 } }
          : {
              data: [{
                id: 'r1', title: 'Netzwerktreffen Oktober', url: 'https://vimeo.com/1', availableUntil: '2027-10-14T12:00:00Z',
                attachments: [{ id: 'a1', filename: 'Folien.pptx', url: 'https://x/f.pptx?exp=1&sig=a', size: 10 }],
              }],
            },
      ),
    );
    api.post.mockReset().mockResolvedValue({ data: { id: 'r2' } });
  });

  it('lists recordings with their files and the date they disappear', async () => {
    renderDialog();

    expect(await screen.findByText('Netzwerktreffen Oktober')).toBeInTheDocument();
    expect(screen.getByText('Folien.pptx')).toBeInTheDocument();
    expect(screen.getByText(/Visible to members until/)).toBeInTheDocument();
    expect(await screen.findByText(/available to members for 365 days/)).toBeInTheDocument();
  });

  it('shows no end date and no retention hint when recordings are kept until deleted', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/events/recordings/retention'
          ? { data: { days: 0 } }
          : { data: [{ id: 'r1', title: 'Netzwerktreffen Oktober', url: 'https://vimeo.com/1', availableUntil: null, attachments: [] }] },
      ),
    );
    renderDialog();

    await screen.findByText('Netzwerktreffen Oktober');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/events/recordings/retention'));
    expect(screen.queryByText(/Visible to members until/)).not.toBeInTheDocument();
    expect(screen.queryByText(/available to members for/)).not.toBeInTheDocument();
  });

  it('adds a recording with the duration in seconds', async () => {
    renderDialog();
    await screen.findByText('Netzwerktreffen Oktober');

    await userEvent.type(screen.getByLabelText('Link to the video'), 'https://vimeo.com/2');
    await userEvent.type(screen.getByLabelText('Duration in minutes (optional)'), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Add recording' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/events/e1/recordings', {
        title: 'Netzwerktreffen', url: 'https://vimeo.com/2', duration: 2700,
      }),
    );
  });

  it('needs a web link before it can add', async () => {
    renderDialog();
    await screen.findByText('Netzwerktreffen Oktober');

    await userEvent.type(screen.getByLabelText('Link to the video'), 'kein link');

    expect(screen.getByRole('button', { name: 'Add recording' })).toBeDisabled();
  });
});

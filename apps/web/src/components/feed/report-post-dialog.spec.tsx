import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportPostDialog } from './report-post-dialog';

const api = vi.hoisted(() => ({ post: vi.fn().mockResolvedValue({ data: { reported: true } }) }));
vi.mock('@/lib/api-client', () => ({ default: api }));

describe('ReportPostDialog', () => {
  it('sends the chosen reason with the optional details, then closes', async () => {
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPostDialog postId="p1" onClose={onClose} />
      </QueryClientProvider>,
    );

    const send = screen.getByRole('button', { name: 'Send report' });
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByLabelText('Spam or advertising'));
    await userEvent.type(screen.getByLabelText('Details (optional)'), 'Links to a shop');
    await userEvent.click(send);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/posts/p1/report', { reason: 'Spam or advertising: Links to a shop' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

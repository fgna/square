import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeleteMemberDialog } from './delete-member-dialog';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

const member = { id: 'm1', name: 'Bob', email: 'bob@example.com' };

function renderDialog(onDeleted = vi.fn(), onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeleteMemberDialog member={member} onClose={onClose} onDeleted={onDeleted} />
    </QueryClientProvider>,
  );
  return { onDeleted, onClose };
}

describe('DeleteMemberDialog', () => {
  beforeEach(() => api.post.mockReset().mockResolvedValue({ data: { message: 'Account deleted' } }));

  it('only deletes after the e-mail address is typed', async () => {
    const { onDeleted, onClose } = renderDialog();
    const confirm = screen.getByRole('button', { name: 'Delete for good' });
    const field = screen.getByLabelText('To confirm, type the e-mail address: bob@example.com');

    expect(confirm).toBeDisabled();
    await userEvent.type(field, 'bob@exampl');
    expect(confirm).toBeDisabled();

    await userEvent.type(field, 'e.COM');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);

    expect(api.post).toHaveBeenCalledWith('/admin/users/m1/delete', { confirmEmail: 'bob@example.COM' });
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('can be cancelled without deleting', async () => {
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Goal } from '@/hooks/use-goals';

const update = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const goals = vi.hoisted(() => ({ list: [] as Goal[] }));

vi.mock('@/hooks/use-goals', () => ({
  useGoals: () => ({ data: goals.list, isLoading: false, isError: false }),
  useCreateGoal: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateGoal: () => ({ mutate: update, isPending: false }),
  useDeleteGoal: () => ({ mutate: remove, isPending: false }),
}));

import { MyGoals } from './my-goals';

const GOAL: Goal = {
  id: 'g1',
  title: 'Weekly 1:1s',
  description: 'With every direct report',
  targetDate: '2026-12-31T00:00:00.000Z',
  progress: 40,
  status: 'ACTIVE',
} as Goal;

describe('MyGoals', () => {
  beforeEach(() => {
    update.mockReset();
    remove.mockReset();
    goals.list = [GOAL];
  });

  it('opens the goal for editing when it is clicked, without completing it', async () => {
    render(<MyGoals />);
    await userEvent.click(screen.getByRole('button', { name: /Weekly 1:1s/ }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Goal')).toHaveValue('Weekly 1:1s');
    expect(screen.getByLabelText(/Progress/)).toHaveValue(40);
  });

  it('saves title, description, date and progress together', async () => {
    render(<MyGoals />);
    await userEvent.click(screen.getByRole('button', { name: /Weekly 1:1s/ }));
    const title = screen.getByLabelText('Goal');
    await userEvent.clear(title);
    await userEvent.type(title, 'Biweekly 1:1s');
    const progress = screen.getByLabelText(/Progress/);
    await userEvent.clear(progress);
    await userEvent.type(progress, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith(
      { id: 'g1', title: 'Biweekly 1:1s', description: 'With every direct report', targetDate: '2026-12-31', progress: 60 },
      expect.anything(),
    );
  });

  it('removes the target date when the field is emptied', async () => {
    render(<MyGoals />);
    await userEvent.click(screen.getByRole('button', { name: /Weekly 1:1s/ }));
    await userEvent.clear(screen.getByLabelText(/Target date/));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(update.mock.calls[0][0]).toMatchObject({ targetDate: null });
  });

  it('completes a goal only through its own control', async () => {
    render(<MyGoals />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark as completed' }));
    expect(update).toHaveBeenCalledWith({ id: 'g1', status: 'COMPLETED' });
  });
});

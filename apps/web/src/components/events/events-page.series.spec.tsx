import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventsPage } from './events-page';

const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const ev = (id: string, title: string, days: number, extra: object = {}) => ({
  id, title, description: 'x', startsAt: soon(days), endsAt: soon(days + 0.04), isVirtual: true, rsvps: [], createdAt: soon(-1), _count: { rsvps: 0 }, ...extra,
});
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'MEMBER' } }) }));
vi.mock('@/components/event-proposals/event-proposals-section', () => ({ EventProposalsSection: () => null }));

describe('EventsPage series and highlights', () => {
  it('shows a daily series once by default, all dates on request, and marks highlighted events', async () => {
    api.get.mockImplementation(async (url: string) =>
      url === '/events'
        ? { data: { data: [ev('d1', 'Daily', 1, { seriesId: 's1' }), ev('d2', 'Daily', 2, { seriesId: 's1' }), ev('w1', 'Weekly live', 3, { featured: true })], total: 3, totalPages: 1 } }
        : { data: [] },
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EventsPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Weekly live')).toBeInTheDocument();
    expect(screen.getAllByText('Daily')).toHaveLength(1);
    expect(screen.getByText('Recurring – more dates in the calendar')).toBeInTheDocument();
    expect(screen.getByText(/Highlighted/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch'));
    expect(screen.getAllByText('Daily')).toHaveLength(2);
  });
});

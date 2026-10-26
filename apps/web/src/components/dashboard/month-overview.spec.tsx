import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonthOverview } from './month-overview';

const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

describe('MonthOverview', () => {
  it('lists the next 30 days with each series once', async () => {
    api.get.mockImplementation(async (url: string, opts: any) => {
      if (url === '/events') {
        expect(opts.params.from).toBeTruthy();
        expect(opts.params.to).toBeTruthy();
        return {
          data: {
            data: [
              { id: 'd1', title: 'Daily start', startsAt: soon(1), endsAt: soon(1), seriesId: 's1' },
              { id: 'd2', title: 'Daily start', startsAt: soon(2), endsAt: soon(2), seriesId: 's1' },
              { id: 'w1', title: 'Workshop', startsAt: soon(3), endsAt: soon(3), seriesId: null },
            ],
            total: 3,
          },
        };
      }
      return {
        data: {
          data: [
            { id: 'r1', title: 'Workshop replay', createdAt: soon(-2), event: { title: 'Workshop' } },
            { id: 'r2', title: 'Old replay', createdAt: soon(-30) },
          ],
        },
      };
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MonthOverview />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Daily start')).toBeInTheDocument();
    expect(screen.getAllByText('Workshop').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Daily start')).toHaveLength(1);
    expect(screen.getByText('recurring')).toBeInTheDocument();
    expect(screen.queryByText('New recordings')).toBeNull();
  });
});

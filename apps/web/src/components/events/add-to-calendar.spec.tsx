import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CommunityEvent } from '@community/shared';
import { AddToCalendar, popoverPosition } from './add-to-calendar';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const viewport = { width: 1200, height: 800 };

describe('popoverPosition', () => {
  it('opens below the button when there is room', () => {
    expect(popoverPosition({ top: 100, bottom: 130, right: 1000 }, viewport)).toEqual({
      right: 200,
      top: 136,
    });
  });

  it('opens above the button near the bottom of the screen', () => {
    expect(popoverPosition({ top: 740, bottom: 770, right: 1000 }, viewport)).toEqual({
      right: 200,
      bottom: 66,
    });
  });
});

describe('AddToCalendar', () => {
  it('renders its menu outside the card, so the next card cannot cover it', async () => {
    const event = {
      id: 'ev1',
      title: 'Journaling',
      startsAt: '2026-09-22T08:00:00Z',
      endsAt: '2026-09-22T09:00:00Z',
      description: '',
    } as CommunityEvent;
    const { container } = render(
      <div data-testid="card">
        <AddToCalendar event={event} />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));

    const menu = screen.getByRole('dialog', { name: 'Add to calendar' });
    expect(container.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
  });

  it('offers the subscription before the one-time copies', async () => {
    const event = {
      id: 'ev2',
      title: 'Meetup',
      startsAt: '2026-09-22T08:00:00Z',
      endsAt: '2026-09-22T09:00:00Z',
      description: '',
    } as CommunityEvent;
    render(<AddToCalendar event={event} />);

    await userEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));

    const subscribe = screen.getByRole('link', { name: /Set up calendar subscription/ });
    const google = screen.getByRole('link', { name: /Google/ });
    expect(subscribe).toHaveAttribute('href', '/settings#calendar-feed');
    expect(subscribe.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

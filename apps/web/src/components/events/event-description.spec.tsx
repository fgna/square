import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventDescription } from './event-description';

describe('EventDescription', () => {
  it('shows links from the editor as links', () => {
    render(<EventDescription text='<p>Bitte vorher <a href="https://x.de/anmeldung" class="md-link">anmelden</a>.</p>' />);

    expect(screen.getByRole('link', { name: 'anmelden' })).toHaveAttribute('href', 'https://x.de/anmeldung');
  });

  it('still shows plain-text descriptions of older events', () => {
    render(<EventDescription text="Treffen zum Austausch über Führung im Alltag." />);

    expect(screen.getByText('Treffen zum Austausch über Führung im Alltag.')).toBeInTheDocument();
  });

  it('drops anything unsafe', () => {
    const { container } = render(<EventDescription text='<p>Hi<img src=x onerror="alert(1)"><script>alert(2)</script></p>' />);

    expect(container.innerHTML).not.toMatch(/onerror|<script/);
  });

  it('opens long descriptions on request', async () => {
    render(<EventDescription text={`<p>${'Lang '.repeat(60)}</p>`} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
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

  it('opens descriptions that three lines cut off', async () => {
    // jsdom has no layout: pretend the clamped text is taller than its box.
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(120);
    const box = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60);
    render(<EventDescription text={`<p>${'Lang '.repeat(60)}</p>`} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    height.mockRestore();
    box.mockRestore();
  });

  it('offers no "show more" when nothing is cut off', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(60);
    const box = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60);
    render(<EventDescription text={`<p>${'Lang '.repeat(60)}</p>`} />);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    height.mockRestore();
    box.mockRestore();
  });
});

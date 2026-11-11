import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MediaDock } from './media-dock';
import { useMediaStore } from '@/store/media.store';

beforeAll(() => {
  // jsdom has no media playback.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

const ITEM = { key: '/uploads/audio/m.mp3', src: '/uploads/audio/m.mp3?exp=1&sig=a', title: 'Monday Motivator', href: '/feed' };

describe('MediaDock', () => {
  beforeEach(() => useMediaStore.setState({ docked: null, dockPosition: 0 }));

  it('shows nothing while nothing was handed over', () => {
    render(<MediaDock />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('continues handed-over media and leads back to its page', () => {
    render(<MediaDock />);
    act(() => useMediaStore.getState().dock(ITEM, 61));
    expect(screen.getByRole('region', { name: 'Now playing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Monday Motivator/ })).toHaveAttribute('href', '/feed');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('does not start a hand-over that is no longer fresh', () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    useMediaStore.setState({ docked: { ...ITEM, position: 61, dockedAt: Date.now() - 60_000 }, dockPosition: 61 });
    render(<MediaDock />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('stops and disappears when closed', () => {
    render(<MediaDock />);
    act(() => useMediaStore.getState().dock(ITEM, 61));
    fireEvent.click(screen.getByRole('button', { name: 'Stop and close' }));
    expect(useMediaStore.getState().docked).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });
});

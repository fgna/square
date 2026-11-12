import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { HostedAudio } from './hosted-audio';
import { useMediaStore } from '@/store/media.store';
import { useAuthStore } from '@/store/auth.store';
import { readPosition, writePosition } from '@/lib/media-position';

// jsdom has no media playback: play/pause only flip the state and fire the events.
const paused = new WeakMap<HTMLMediaElement, boolean>();
const original = {
  play: HTMLMediaElement.prototype.play,
  pause: HTMLMediaElement.prototype.pause,
  paused: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused'),
  readyState: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState'),
};

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get(this: HTMLMediaElement) {
      return paused.get(this) ?? true;
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 0 });
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    paused.set(this, false);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
    if (paused.get(this) === false) {
      paused.set(this, true);
      this.dispatchEvent(new Event('pause'));
    }
  };
});

afterAll(() => {
  HTMLMediaElement.prototype.play = original.play;
  HTMLMediaElement.prototype.pause = original.pause;
  if (original.paused) Object.defineProperty(HTMLMediaElement.prototype, 'paused', original.paused);
  if (original.readyState) Object.defineProperty(HTMLMediaElement.prototype, 'readyState', original.readyState);
});

const SRC = '/uploads/audio/motivator.mp3?exp=100&sig=aaa';
const KEY = '/uploads/audio/motivator.mp3';

function audio(container: HTMLElement) {
  return container.querySelector('audio') as HTMLAudioElement;
}

describe('HostedAudio', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMediaStore.setState({ docked: null, dockPosition: 0 });
    useAuthStore.setState({ user: { id: 'member-1' } as never, isAuthenticated: true });
  });

  it('continues where the member stopped last time', () => {
    writePosition('member-1', KEY, 95);
    const { container } = render(<HostedAudio src={SRC} title="Monday Motivator" />);
    const el = audio(container);
    act(() => void el.dispatchEvent(new Event('loadedmetadata')));
    expect(el.currentTime).toBe(95);
  });

  it('hands playing audio to the mini player when the page is left', async () => {
    const { container, unmount } = render(<HostedAudio src={SRC} title="Monday Motivator" />);
    const el = audio(container);
    await act(() => el.play());
    el.currentTime = 61;
    unmount();
    const docked = useMediaStore.getState().docked;
    expect(docked).toMatchObject({ key: KEY, src: SRC, title: 'Monday Motivator', position: 61 });
    expect(readPosition('member-1', KEY)).toBe(61);
  });

  it('leads back to the page it was given, e.g. the post itself', async () => {
    const { container, unmount } = render(<HostedAudio src={SRC} title="Monday Motivator" backHref="/feed/post-7" />);
    await act(() => audio(container).play());
    unmount();
    expect(useMediaStore.getState().docked?.href).toBe('/feed/post-7');
  });

  it('does not start anything when paused audio is left', () => {
    const { unmount } = render(<HostedAudio src={SRC} title="Monday Motivator" />);
    unmount();
    expect(useMediaStore.getState().docked).toBeNull();
  });

  it('takes it back from the mini player at the current moment', () => {
    useMediaStore.getState().dock({ key: KEY, src: SRC, title: 'Monday Motivator', href: '/feed' }, 61);
    useMediaStore.getState().setDockPosition(130);
    const { container } = render(<HostedAudio src={SRC} title="Monday Motivator" />);
    const el = audio(container);
    act(() => void el.dispatchEvent(new Event('loadedmetadata')));
    expect(useMediaStore.getState().docked).toBeNull();
    expect(el.paused).toBe(false);
    expect(el.currentTime).toBe(130);
  });

  it('keeps the moment when taken back under StrictMode (effects run twice)', () => {
    useMediaStore.getState().dock({ key: KEY, src: SRC, title: 'Monday Motivator', href: '/feed' }, 61);
    useMediaStore.getState().setDockPosition(130);
    const { container } = render(
      <StrictMode>
        <HostedAudio src={SRC} title="Monday Motivator" />
      </StrictMode>,
    );
    const el = audio(container);
    act(() => void el.dispatchEvent(new Event('loadedmetadata')));
    expect(el.currentTime).toBe(130);
  });

  it('does not overwrite the remembered moment before the file has loaded', async () => {
    writePosition('member-1', KEY, 95);
    const { container } = render(<HostedAudio src={SRC} title="Monday Motivator" />);
    const el = audio(container);
    await act(() => el.play());
    act(() => el.pause());
    expect(readPosition('member-1', KEY)).toBe(95);
  });

  it('keeps its link when a refetch brings a newly signed one', () => {
    const { container, rerender } = render(<HostedAudio src={SRC} title="Monday Motivator" />);
    rerender(<HostedAudio src="/uploads/audio/motivator.mp3?exp=200&sig=bbb" title="Monday Motivator" />);
    expect(audio(container).getAttribute('src')).toBe(SRC);
  });

  it('plays only one thing at a time', async () => {
    const { container } = render(
      <>
        <HostedAudio src={SRC} title="One" />
        <HostedAudio src="/uploads/audio/other.mp3?exp=1&sig=c" title="Two" />
      </>,
    );
    const [first, second] = Array.from(container.querySelectorAll('audio'));
    await act(() => first.play());
    await act(() => second.play());
    expect(first.paused).toBe(true);
    expect(second.paused).toBe(false);
  });

  it('forgets the position once the audio has ended', () => {
    writePosition('member-1', KEY, 95);
    const { container } = render(<HostedAudio src={SRC} title="Monday Motivator" />);
    act(() => void audio(container).dispatchEvent(new Event('ended')));
    expect(readPosition('member-1', KEY)).toBeNull();
  });
});

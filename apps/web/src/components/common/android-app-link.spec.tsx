import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AndroidAppLink } from './android-app-link';
import GetAppPage from '@/app/get-app/page';

const state = vi.hoisted(() => ({ data: undefined as undefined | {
  androidAppDownloadEnabled: boolean; androidAppDownloadUrl: string | null;
}, isLoading: false }));
vi.mock('@/hooks/use-branding', () => ({ useBranding: () => state }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string, values?: { url: string }) =>
  key === 'stepServer' ? `Server: ${values?.url}` : key }));
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

afterEach(() => { cleanup(); state.data = undefined; vi.unstubAllGlobals(); });

describe('public Android download entry', () => {
  it('hides the entry by default, when disabled and for unsafe URLs', () => {
    const view = render(<AndroidAppLink />);
    expect(screen.queryByRole('link')).toBeNull();
    for (const data of [
      { androidAppDownloadEnabled: false, androidAppDownloadUrl: 'https://example.com/app.apk' },
      { androidAppDownloadEnabled: true, androidAppDownloadUrl: 'javascript:bad' },
    ]) {
      state.data = data;
      view.rerender(<AndroidAppLink />);
      expect(screen.queryByRole('link')).toBeNull();
    }
  });

  it('shows the enabled entry and removes it after disabling', () => {
    state.data = { androidAppDownloadEnabled: true, androidAppDownloadUrl: 'https://example.com/app.apk' };
    const view = render(<AndroidAppLink />);
    expect(screen.getByRole('link', { name: 'download' })).toHaveAttribute('href', '/get-app');
    state.data.androidAppDownloadEnabled = false;
    view.rerender(<AndroidAppLink />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('links directly to the APK and shows the current community without a CORS probe', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    state.data = { androidAppDownloadEnabled: true, androidAppDownloadUrl: 'https://example.com/app.apk' };
    render(<GetAppPage />);
    expect(screen.getByRole('link', { name: 'download' })).toHaveAttribute('href', 'https://example.com/app.apk');
    expect(screen.getByText(`Server: ${window.location.origin}`)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not offer a direct download or installation steps when disabled', () => {
    state.data = { androidAppDownloadEnabled: false, androidAppDownloadUrl: null };
    render(<GetAppPage />);
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'download' })).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

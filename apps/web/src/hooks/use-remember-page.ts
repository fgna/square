'use client';

import { useEffect } from 'react';
import { HOME_PATH } from '@/plugins/home.generated';
import { rememberPage } from '@/lib/start-page';

function current(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Remembers the page the member has open, for "pick up where you left off"
 * (see lib/start-page). Written on every page change and again when the app
 * goes to the background, so the 24 hours count from when it was last used.
 */
export function useRememberPage(pathname: string | null): void {
  useEffect(() => {
    if (pathname) rememberPage(current(), HOME_PATH);
  }, [pathname]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') rememberPage(current(), HOME_PATH);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
}

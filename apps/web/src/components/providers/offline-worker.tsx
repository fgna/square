'use client';

import { useEffect } from 'react';

/** Registers only a navigation fallback; it cannot cache private responses. */
export function OfflineWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Browsers without service workers continue using ordinary network navigation.
    });
  }, []);

  return null;
}

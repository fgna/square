'use client';

import type { ComponentType, ReactNode } from 'react';
import { LegalLinks } from '@/components/common/legal-links';
import { AndroidAppLink } from '@/components/common/android-app-link';
import { findWebPlugin } from '@/plugins';
import { HOME_PLUGIN } from '@/plugins/home.generated';

/** The start page plugin's frame for the sign-in pages, if it brings one. */
export function homeAuthFrame(home: string | null = HOME_PLUGIN): ComponentType<{ children: ReactNode }> | null {
  const plugin = home ? findWebPlugin(home)?.plugin : undefined;
  return (plugin?.AuthFrame as ComponentType<{ children: ReactNode }> | undefined) ?? null;
}

export function AuthFrame({ children }: { children: ReactNode }) {
  const Frame = homeAuthFrame();
  if (Frame) {
    return (
      <Frame>
        {children}
        <AndroidAppLink className="mt-6" />
        <LegalLinks className="mt-6" />
      </Frame>
    );
  }
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--theme-background)' }}
    >
      {/* Background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(197,168,128,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.05) 0%, transparent 50%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--theme-text)' }}
          >
            Community Platform
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            Your premium learning community
          </p>
        </div>
        {children}
        <AndroidAppLink className="mt-6" />
        <LegalLinks className="mt-6" />
      </div>
    </div>
  );
}

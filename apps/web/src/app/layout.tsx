import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/lib/theme-provider';
import { loadCommunityTheme } from '@/lib/community-theme.server';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/toast';
import { CookieBanner } from '@/components/gdpr/cookie-banner';
import { OfflineWorker } from '@/components/providers/offline-worker';
import './globals.css';

// Self-hosted at build time: visitors' browsers never contact Google, so no
// IP address goes to Google Fonts (LG München, 3 O 17493/20).
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Community Platform',
    template: '%s | Community Platform',
  },
  description: 'A premium community and learning platform',
  applicationName: 'Community Platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Community Platform', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090d16',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const communityTheme = loadCommunityTheme();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <ThemeProvider communityTheme={communityTheme}>
              {children}
              <Toaster />
              <CookieBanner />
              <OfflineWorker />
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

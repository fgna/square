import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/lib/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/toast';
import { CookieBanner } from '@/components/gdpr/cookie-banner';
import { OfflineWorker } from '@/components/providers/offline-worker';
import { getServerBranding } from '@/lib/server-branding';
import './globals.css';

// Self-hosted at build time: visitors' browsers never contact Google, so no
// IP address goes to Google Fonts (LG München, 3 O 17493/20).
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], display: 'swap', variable: '--font-inter' });

// Tab title and home-screen name follow the name set in Admin → Settings.
export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await getServerBranding();
  return {
    title: {
      default: platformName,
      template: `%s | ${platformName}`,
    },
    description: 'A premium community and learning platform',
    applicationName: platformName,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: platformName, statusBarStyle: 'black-translucent' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090d16',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <ThemeProvider>
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

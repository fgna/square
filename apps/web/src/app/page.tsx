import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AndroidAppLink } from '@/components/common/android-app-link';
import { getServerBranding, joinHref } from '@/lib/server-branding';
import { Users, BookOpen, Calendar, MessageSquare, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: Users,
    titleKey: 'memberTitle', descriptionKey: 'memberDescription',
  },
  {
    icon: BookOpen,
    titleKey: 'learningTitle', descriptionKey: 'learningDescription',
  },
  {
    icon: Calendar,
    titleKey: 'eventsTitle', descriptionKey: 'eventsDescription',
  },
  {
    icon: MessageSquare,
    titleKey: 'messagingTitle', descriptionKey: 'messagingDescription',
  },
  {
    icon: Shield,
    titleKey: 'gdprTitle', descriptionKey: 'gdprDescription',
  },
  {
    icon: Zap,
    titleKey: 'hostedTitle', descriptionKey: 'hostedDescription',
  },
];

export default async function LandingPage() {
  const t = await getTranslations('landingUI');
  const branding = await getServerBranding();
  const { platformName } = branding;
  // Invitation-only communities send visitors to their own page instead of a closed form.
  const join = joinHref(branding);
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--theme-background)', color: 'var(--theme-text)' }}
    >
      {/* Background gradients */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 30%, rgba(197,168,128,0.07) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(99,102,241,0.05) 0%, transparent 50%)',
        }}
      />

      {/* Nav */}
      <header className="relative z-10 w-full border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-6 min-h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <span className="text-sm sm:text-lg font-semibold leading-tight">{platformName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors hover:opacity-80"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              {t('signin')}
            </Link>
            <Link
              href={join}
              className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors"
              style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
            >
              {t('start')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            {t('heroPrefix')}
            <br />
            <span style={{ color: 'var(--theme-primary)' }}>{t('heroSuffix')}</span>
          </h1>
          <p
            className="mt-6 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            {t('heroDescription')}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={join}
              className="px-8 py-3 text-base font-semibold rounded-xl transition-all hover:scale-105"
              style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
            >
              {t('join')}
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 text-base font-semibold rounded-xl border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}
            >
              {t('signInTitle')}
            </Link>
          </div>
          <AndroidAppLink className="mt-6" />
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            {t('featuresHeading')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.titleKey}
                className="rounded-xl p-6 transition-all hover:scale-[1.02]"
                style={{
                  background: 'var(--theme-card)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'rgba(197,168,128,0.1)', color: 'var(--theme-primary)' }}
                >
                  <feature.icon size={20} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey)}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  {t(feature.descriptionKey)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div
            className="rounded-2xl p-12"
            style={{
              background: 'var(--theme-card)',
              border: '1px solid var(--theme-border)',
            }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('ready')}</h2>
            <p className="mb-8" style={{ color: 'var(--theme-text-muted)' }}>
              {t('readyDescription')}
            </p>
            <Link
              href={join}
              className="inline-block px-8 py-3 text-base font-semibold rounded-xl transition-all hover:scale-105"
              style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
            >
              {t('createAccount')}
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t py-8" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          <span>&copy; {new Date().getFullYear()} {platformName}</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:opacity-80 transition-opacity">{t('signInTitle')}</Link>
            <Link href={join} className="hover:opacity-80 transition-opacity">{t('register')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

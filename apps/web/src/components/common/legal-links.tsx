'use client';

import { useTranslations } from 'next-intl';
import { PRIVACY_URL, IMPRINT_URL } from '@/lib/legal';

/** "Datenschutz · Impressum", on the sign-in pages and in the sidebar. */
export function LegalLinks({ className = '' }: { className?: string }) {
  const t = useTranslations('legal');
  const links = [
    PRIVACY_URL && { href: PRIVACY_URL, label: t('privacy') },
    IMPRINT_URL && { href: IMPRINT_URL, label: t('imprint') },
  ].filter(Boolean) as { href: string; label: string }[];
  if (links.length === 0) return null;

  return (
    <p className={`text-xs flex justify-center gap-3 ${className}`} style={{ color: 'var(--theme-text-muted)' }}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {l.label}
        </a>
      ))}
    </p>
  );
}

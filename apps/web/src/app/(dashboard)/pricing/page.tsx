'use client';

import { useTranslations } from 'next-intl';
import { useTier } from '@/hooks/use-tier';
import { useBillingCheckout, useBillingPortal } from '@/hooks/use-billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Star, Loader2 } from 'lucide-react';

const FREE_FEATURE_KEYS = ["freeFeed","freeCourses","freeEvents","freeMembers","freeProfile"] as const;
const PREMIUM_FEATURE_KEYS = ["premiumPosts","premiumCourses","premiumEvents","premiumMessages","premiumGroups","premiumJournal","premiumUploads","premiumInterests","premiumSupport"] as const;

export default function PricingPage() {
  const t = useTranslations('pricingUI');
  const { data: tier } = useTier();
  const checkout = useBillingCheckout();
  const portal = useBillingPortal();
  const isPremium = tier?.isPremium;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>
          {t('title')}
        </h2>
        <p className="text-sm mt-2" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('free')}</CardTitle>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--theme-text)' }}>
              $0<span className="text-sm font-normal" style={{ color: 'var(--theme-text-muted)' }}>{t('perMonth')}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {FREE_FEATURE_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                <Check size={14} className="flex-shrink-0" style={{ color: 'var(--theme-text-muted)' }} />
                {t(key)}
              </div>
            ))}
            {!isPremium && (
              <div className="pt-3">
                <Button variant="outline" className="w-full" disabled>
                  {t('current')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card style={{ border: '2px solid var(--theme-primary)' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{t('premium')}</CardTitle>
              <Star size={16} style={{ color: 'var(--theme-primary)', fill: 'var(--theme-primary)' }} />
            </div>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--theme-text)' }}>
              {t('contact')}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {PREMIUM_FEATURE_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text)' }}>
                <Check size={14} className="flex-shrink-0" style={{ color: 'var(--theme-primary)' }} />
                {t(key)}
              </div>
            ))}
            <div className="pt-3">
              {isPremium ? (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => portal.mutate()}
                  disabled={portal.isPending}
                >
                  {portal.isPending ? (
                    <><Loader2 size={14} className="animate-spin mr-2" />{t('loading')}</>
                  ) : t('manage')}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => checkout.mutate()}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? (
                    <><Loader2 size={14} className="animate-spin mr-2" />{t('redirecting')}</>
                  ) : t('upgrade')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

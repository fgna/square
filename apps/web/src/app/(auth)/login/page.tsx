'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { SocialButtons } from '@/components/auth/social-buttons';
import { useBranding } from '@/hooks/use-branding';
import { authLink, currentFrom } from '@/lib/home';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { login, loginLoading, loginError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations('auth');
  const { data: branding } = useBranding();
  // Read after mounting: the page is prerendered without a query.
  const [registerHref, setRegisterHref] = useState('/register');
  const [forgotHref, setForgotHref] = useState('/forgot-password');
  useEffect(() => {
    setRegisterHref(authLink('/register', currentFrom()));
    setForgotHref(authLink('/forgot-password', currentFrom()));
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data);
    } catch {
      // error handled by mutation state
    }
  };

  return (
    <div
      className="glass rounded-2xl p-8"
      style={{ border: '1px solid var(--theme-border)' }}
    >
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--theme-text)' }}>
        {t('signInTitle')}
      </h2>

      <SocialButtons />

      {loginError && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
          }}
        >
          {(() => {
            const msg = (loginError as { response?: { data?: { message?: string | string[] } } })
              ?.response?.data?.message;
            return Array.isArray(msg) ? msg[0] : (msg || t('invalidCredentials'));
          })()}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            {...register('email', { required: t('emailRequired') })}
            className="mt-1"
          />
          {errors.email && (
            <p className="text-xs mt-1" style={{ color: 'var(--theme-danger)' }}>
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password', { required: t('passwordRequired') })}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--theme-text-muted)' }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs mt-1" style={{ color: 'var(--theme-danger)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="text-right text-sm"><Link href={forgotHref} className="hover:underline" style={{ color: 'var(--theme-primary)' }}>{t('forgotPassword')}</Link></div>
        <Button type="submit" className="w-full" disabled={loginLoading}>
          {loginLoading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              {t('signingIn')}
            </>
          ) : (
            t('signIn')
          )}
        </Button>
      </form>

      {branding?.allowSignups !== false && (
        <p className="mt-4 text-center text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {t('noAccount')}{' '}
          <Link
            href={registerHref}
            className="font-medium hover:underline"
            style={{ color: 'var(--theme-primary)' }}
          >
            {t('signUp')}
          </Link>
        </p>
      )}
    </div>
  );
}

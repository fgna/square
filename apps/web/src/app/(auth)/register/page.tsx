'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { SocialButtons } from '@/components/auth/social-buttons';
import { useBranding } from '@/hooks/use-branding';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function RegisterForm() {
  const { register: registerUser, registerLoading, registerError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? undefined;
  const t = useTranslations('auth');
  const { data: branding } = useBranding();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        email: data.email,
        name: data.name,
        password: data.password,
        inviteToken,
      });
    } catch {
      // error handled by mutation state
    }
  };

  if (!inviteToken && branding?.allowSignups === false) {
    return (
      <div className="glass rounded-2xl p-8" style={{ border: '1px solid var(--theme-border)' }}>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--theme-text)' }}>
          {t('inviteOnlyTitle')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {t('inviteOnlyMessage')}
        </p>
        <p className="mt-4 text-center text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {t('haveAccount')}{' '}
          <Link
            href="/login"
            className="font-medium hover:underline"
            style={{ color: 'var(--theme-primary)' }}
          >
            {t('signIn')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-8" style={{ border: '1px solid var(--theme-border)' }}>
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--theme-text)' }}>
        {t('createAccountTitle')}
      </h2>

      {inviteToken && (
        <div
          className="mb-4 flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
        >
          <Mail size={14} />
          {t('inviteMessage')}
        </div>
      )}

      <SocialButtons />

      {registerError && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
          }}
        >
          {(() => {
            const res = (registerError as { response?: { status?: number; data?: { message?: string | string[] } } })
              ?.response;
            if (res?.status === 403) return t('inviteOnlyMessage');
            const msg = res?.data?.message;
            return Array.isArray(msg) ? msg[0] : (msg || t('registrationFailed'));
          })()}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">{t('fullName')}</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder={t('namePlaceholder')}
            {...register('name', {
              required: t('nameRequired'),
              minLength: { value: 2, message: t('nameMinLength') },
            })}
            className="mt-1"
          />
          {errors.name && (
            <p className="text-xs mt-1" style={{ color: 'var(--theme-danger)' }}>
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            {...register('email', {
              required: t('emailRequired'),
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('emailInvalid') },
            })}
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
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              {...register('password', {
                required: t('passwordRequired'),
                minLength: { value: 8, message: t('passwordMinLength') },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: t('passwordComplexity'),
                },
              })}
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

        <div>
          <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder={t('confirmPasswordPlaceholder')}
            {...register('confirmPassword', {
              required: t('confirmPasswordRequired'),
              validate: (val) => val === password || t('passwordsMismatch'),
            })}
            className="mt-1"
          />
          {errors.confirmPassword && (
            <p className="text-xs mt-1" style={{ color: 'var(--theme-danger)' }}>
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={registerLoading}>
          {registerLoading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              {t('creatingAccount')}
            </>
          ) : (
            t('createAccount')
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        {t('haveAccount')}{' '}
        <Link
          href="/login"
          className="font-medium hover:underline"
          style={{ color: 'var(--theme-primary)' }}
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

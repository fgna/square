'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ResetForm() {
  const t = useTranslations('auth');
  const params = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setPending(true);
    setError(false);
    try {
      await apiClient.post('/auth/password-reset/confirm', { token, password });
      setDone(true);
      window.history.replaceState(null, '', '/reset-password');
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="glass rounded-2xl p-8" style={{ border: '1px solid var(--theme-border)' }}>
      <h2 className="text-xl font-semibold mb-6">{t('resetRequestTitle')}</h2>
      {done ? <p role="status">{t('resetDone')}</p> : token ? (
        <form onSubmit={submit} className="space-y-4">
          <Label htmlFor="newPassword">{t('resetNewPassword')}</Label>
          <Input id="newPassword" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128}/>
          {error && <p role="alert">{t('resetInvalid')}</p>}
          <Button type="submit" disabled={pending} className="w-full">{t('resetConfirmButton')}</Button>
        </form>
      ) : <p role="alert">{t('resetInvalid')}</p>}
      <p className="mt-4 text-center text-sm"><Link href="/login" className="hover:underline">{t('backToLogin')}</Link></p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}

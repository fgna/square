'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(false);
    try {
      await apiClient.post('/auth/password-reset/request', { email });
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="glass rounded-2xl p-8" style={{ border: '1px solid var(--theme-border)' }}>
      <h2 className="text-xl font-semibold mb-6">{t('resetRequestTitle')}</h2>
      {done ? <p role="status">{t('resetRequestDone')}</p> : (
        <form onSubmit={submit} className="space-y-4">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254}/>
          {error && <p role="alert">{t('resetError')}</p>}
          <Button type="submit" disabled={pending} className="w-full">{t('resetRequestButton')}</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link href="/login" className="hover:underline">{t('backToLogin')}</Link></p>
    </div>
  );
}

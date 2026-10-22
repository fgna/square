'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';

export default function BillingSuccessPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['tier'] });
    queryClient.invalidateQueries({ queryKey: ['billing'] });
    queryClient.invalidateQueries({ queryKey: ['me'] });
    const t = setTimeout(() => router.push('/dashboard'), 4000);
    return () => clearTimeout(t);
  }, [queryClient, router]);

  return (
    <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
      <div
        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'rgba(34,197,94,0.15)' }}
      >
        <Check size={32} style={{ color: '#22c55e' }} />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--theme-text)' }}>
        Welcome to Premium!
      </h2>
      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        Your subscription is active. You now have access to all premium features.
        Redirecting to dashboard...
      </p>
    </div>
  );
}

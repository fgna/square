'use client';

import { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { verifyOAuthState } from '@/lib/oauth';
import apiClient from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

function CallbackHandler() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { oauthLogin, isAuthenticated } = useAuth();
  const handled = useRef(false);

  const provider = params.provider as string;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (error || !code) {
      router.replace('/login?error=oauth_denied');
      return;
    }

    if (!verifyOAuthState(state)) {
      router.replace('/login?error=oauth_state_mismatch');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback/${provider}`;
    const isLinkMode = sessionStorage.getItem('oauth_link_mode') === 'true';
    sessionStorage.removeItem('oauth_link_mode');

    if (isLinkMode && isAuthenticated) {
      apiClient.post(`/auth/oauth/link/${provider}`, { code, redirectUri })
        .then(() => router.replace('/settings'))
        .catch(() => router.replace('/settings?error=link_failed'));
    } else {
      oauthLogin({ provider, code, redirectUri }).catch(() => {
        router.replace('/login?error=oauth_failed');
      });
    }
  }, [code, state, error, provider, oauthLogin, isAuthenticated, router]);

  return (
    <div className="glass rounded-2xl p-8 text-center" style={{ border: '1px solid var(--theme-border)' }}>
      <Loader2 size={32} className="animate-spin mx-auto mb-4" style={{ color: 'var(--theme-primary)' }} />
      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        Completing sign in...
      </p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}

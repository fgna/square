function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function storeOAuthState(): string {
  const state = generateState();
  sessionStorage.setItem('oauth_state', state);
  return state;
}

export function verifyOAuthState(state: string | null): boolean {
  const stored = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  return !!state && state === stored;
}

export function getGoogleOAuthUrl(): string | null {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const state = storeOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function getLinkedInOAuthUrl(): string | null {
  const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
  if (!clientId) return null;
  const state = storeOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/callback/linkedin`,
    response_type: 'code',
    scope: 'openid profile email',
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

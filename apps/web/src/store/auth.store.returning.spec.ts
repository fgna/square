import { describe, it, expect } from 'vitest';
import { useAuthStore } from './auth.store';

describe('returning-member cookie', () => {
  it('is set at sign-in and kept after sign-out, unlike the session cookies', () => {
    useAuthStore.getState().setAuth({ id: 'u1', email: 'a@example.com', name: 'A', role: 'MEMBER' } as never);
    expect(document.cookie).toContain('returning-member=1');
    expect(document.cookie).toContain('auth-session=1');
    useAuthStore.getState().clearAuth();
    expect(document.cookie).toContain('returning-member=1');
    expect(document.cookie).not.toContain('auth-session=1');
  });
});

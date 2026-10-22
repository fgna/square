import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth.store';
import { type AuthUser, Role } from '@community/shared';

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: Role.MEMBER,
  avatarUrl: null,
};

function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
  });
  localStorage.clear();
  document.cookie = 'auth-session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  document.cookie = 'user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
}

describe('useAuthStore', () => {
  beforeEach(resetStore);

  describe('setAuth', () => {
    it('sets user and isAuthenticated', () => {
      useAuthStore.getState().setAuth(mockUser);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('writes auth-session=1 and user-role cookies', () => {
      useAuthStore.getState().setAuth(mockUser);
      expect(document.cookie).toContain('auth-session=1');
      expect(document.cookie).toContain('user-role=MEMBER');
    });
  });

  describe('updateUser', () => {
    it('merges partial update into existing user', () => {
      useAuthStore.getState().setAuth(mockUser);
      useAuthStore.getState().updateUser({ name: 'Updated Name' });
      const state = useAuthStore.getState();
      expect(state.user?.name).toBe('Updated Name');
      expect(state.user?.email).toBe('test@example.com');
    });

    it('does nothing when user is null', () => {
      useAuthStore.getState().updateUser({ name: 'Updated' });
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('clearAuth', () => {
    it('clears all auth state', () => {
      useAuthStore.getState().setAuth(mockUser);
      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('clears auth cookies', () => {
      useAuthStore.getState().setAuth(mockUser);
      useAuthStore.getState().clearAuth();
      expect(document.cookie).not.toContain('auth-session=1');
    });
  });

  describe('initial state', () => {
    it('starts unauthenticated', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});

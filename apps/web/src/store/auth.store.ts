import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@community/shared';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; SameSite=Lax; max-age=${COOKIE_MAX_AGE}`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
}

// Non-httpOnly session-indicator cookies: read by Next.js middleware for route guards.
// auth-session = "1" means a session exists (actual token validation happens API-side).
// user-role = role string used by middleware to gate /admin routes.
function syncAuthCookies(role: string) {
  setCookie('auth-session', '1');
  setCookie('user-role', role);
}

function clearAuthCookies() {
  deleteCookie('auth-session');
  deleteCookie('user-role');
}

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user) => {
        if (typeof window !== 'undefined') syncAuthCookies(user.role);
        set({ user, isAuthenticated: true });
      },
      updateUser: (partial) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),
      clearAuth: () => {
        if (typeof window !== 'undefined') clearAuthCookies();
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'community-auth',
      // Only user identity and session flag are persisted.
      // The access token lives in api-client's module closure (never persisted).
      // The refresh token lives in an httpOnly cookie (never accessible to JS).
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && state.user && typeof window !== 'undefined') {
          syncAuthCookies(state.user.role);
        }
      },
    },
  ),
);

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import apiClient, { setAccessToken, clearAccessToken } from '@/lib/api-client';
import type { LoginResponse } from '@community/shared';
import { afterSignIn, currentFrom } from '@/lib/home';

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  const loginMutation = useMutation({
    // Rendered from the mutation's own error state on the auth pages.
    meta: { silent: true },
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setAuth(data.user);
      router.push(afterSignIn(currentFrom()));
    },
  });

  const registerMutation = useMutation({
    // Rendered from the mutation's own error state on the auth pages.
    meta: { silent: true },
    mutationFn: async (credentials: { email: string; name: string; password: string; inviteToken?: string }) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/register', credentials);
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setAuth(data.user);
      router.push(afterSignIn(currentFrom()));
    },
  });

  const oauthLoginMutation = useMutation({
    mutationFn: async ({ provider, code, redirectUri }: { provider: string; code: string; redirectUri: string }) => {
      const { data } = await apiClient.post<LoginResponse>(`/auth/oauth/${provider}`, { code, redirectUri });
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setAuth(data.user);
      router.push(afterSignIn(currentFrom()));
    },
  });

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    } finally {
      clearAccessToken();
      clearAuth();
      queryClient.clear();
      router.push('/login');
    }
  }, [clearAuth, queryClient, router]);

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    loginLoading: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    registerLoading: registerMutation.isPending,
    registerError: registerMutation.error,
    oauthLogin: oauthLoginMutation.mutateAsync,
    oauthLoginLoading: oauthLoginMutation.isPending,
    oauthLoginError: oauthLoginMutation.error,
    logout,
  };
}

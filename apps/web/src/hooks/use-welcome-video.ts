import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface WelcomeVideo {
  videoEmbedUrl: string | null;
  dismissed: boolean;
}

/** The welcome video an admin set in Admin → Settings, if any. */
export function useWelcomeVideo() {
  return useQuery<WelcomeVideo>({
    queryKey: ['welcome-video'],
    queryFn: () => apiClient.get('/users/me/welcome').then((r) => r.data),
  });
}

export function useDismissWelcomeVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/users/me/welcome/dismiss'),
    onSuccess: () => queryClient.setQueryData<WelcomeVideo>(['welcome-video'], (v) => (v ? { ...v, dismissed: true } : v)),
  });
}

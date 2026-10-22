import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import type { PaginatedNotifications } from '@community/shared';

export function useUnreadCount() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient.get('/notifications/unread-count').then((r) => r.data),
    enabled: isAuthenticated,
    // This is foreground polling, not operating-system push delivery.
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible' &&
      typeof navigator !== 'undefined' && navigator.onLine ? 30_000 : false,
  });
}

export function useNotifications(page = 1) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<PaginatedNotifications>({
    queryKey: ['notifications', page],
    queryFn: () =>
      apiClient.get('/notifications', { params: { page, limit: 10 } }).then((r) => r.data),
    enabled: isAuthenticated,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

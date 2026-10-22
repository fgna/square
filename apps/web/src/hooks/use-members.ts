import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useMembers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['members', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/users', { params: { page, limit } });
      return data;
    },
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users/me');
      return data;
    },
  });
}

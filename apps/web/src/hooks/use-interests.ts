import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface CategoryInterest {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
}

export function useInterests() {
  return useQuery<CategoryInterest[]>({
    queryKey: ['interests'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users/me/interests');
      return data;
    },
  });
}

export function useUpdateInterests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categoryIds: string[]) => {
      const { data } = await apiClient.put('/users/me/interests', { categoryIds });
      return data as CategoryInterest[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

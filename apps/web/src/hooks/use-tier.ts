import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface TierInfo {
  tier: string;
  isPremium: boolean;
  limits: {
    maxPosts: number;
    maxGroups: number;
    maxUploads: number;
    canAccessAssessments: boolean;
    canAccessJournal: boolean;
  };
}

export function useTier() {
  return useQuery({
    queryKey: ['tier'],
    queryFn: async () => {
      const { data } = await apiClient.get<TierInfo>('/tier');
      return data;
    },
  });
}

export function useUpgradeTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/tier/upgrade');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tier'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

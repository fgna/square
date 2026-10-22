import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Challenge {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  reflection: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface UpsertChallengeInput {
  title: string;
  description?: string;
  reflection?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
}

export function useChallenge() {
  return useQuery({
    queryKey: ['challenge'],
    queryFn: async () => {
      const { data } = await apiClient.get<Challenge | null>('/users/me/challenge');
      return data;
    },
  });
}

export function useUpsertChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertChallengeInput) => {
      const { data } = await apiClient.put<Challenge>('/users/me/challenge', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge'] });
    },
  });
}

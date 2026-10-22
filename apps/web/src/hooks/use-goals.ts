import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  progress: number;
  targetDate: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  targetDate?: string;
  progress?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  targetDate?: string | null;
  progress?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data } = await apiClient.get<Goal[]>('/goals');
      return data;
    },
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      const { data } = await apiClient.post<Goal>('/goals', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateGoalInput & { id: string }) => {
      const { data } = await apiClient.put<Goal>(`/goals/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/goals/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

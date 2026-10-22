import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAiCoachStatus() {
  return useQuery<{ available: boolean }>({
    queryKey: ['ai-coach', 'status'],
    queryFn: () => apiClient.get('/ai-coach/status').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useAiCoachChat() {
  return useMutation({
    mutationFn: async ({ message, history }: { message: string; history: ChatMessage[] }) => {
      const { data } = await apiClient.post<{ message: string }>('/ai-coach/chat', { message, history });
      return data;
    },
  });
}

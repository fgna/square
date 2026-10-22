'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Conversation, PaginatedMessages } from '@community/shared';

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get('/messages/conversations').then(r => r.data),
    refetchInterval: 15_000,
  });
}

export function useMessages(conversationId: string | null, page = 1) {
  return useQuery<PaginatedMessages>({
    queryKey: ['messages', conversationId, page],
    queryFn: () =>
      apiClient.get(`/messages/conversations/${conversationId}/messages`, { params: { page } }).then(r => r.data),
    enabled: !!conversationId,
    refetchInterval: 5_000,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiClient.post(`/messages/conversations/${conversationId}/messages`, { content }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useGetOrCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/messages/conversations/${userId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

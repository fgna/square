import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useEventProposals(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['event-proposals', page, limit],
    queryFn: () =>
      apiClient.get('/event-proposals', { params: { page, limit } }).then((r) => r.data),
  });
}

export function useEventProposal(id: string) {
  return useQuery({
    queryKey: ['event-proposal', id],
    queryFn: () => apiClient.get(`/event-proposals/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    // Reported inline by the form itself; a toast would say it twice.
    meta: { silent: true },
    mutationFn: (data: { title: string; description?: string; proposedDates: string[] }) =>
      apiClient.post('/event-proposals', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-proposals'] }),
  });
}

export function useVoteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dateVotes }: { id: string; dateVotes?: string[] }) =>
      apiClient.post(`/event-proposals/${id}/vote`, { dateVotes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-proposals'] });
      qc.invalidateQueries({ queryKey: ['event-proposal'] });
    },
  });
}

export function useRemoveVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/event-proposals/${id}/vote`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-proposals'] });
      qc.invalidateQueries({ queryKey: ['event-proposal'] });
    },
  });
}

export function useCloseProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/event-proposals/${id}/close`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-proposals'] });
      qc.invalidateQueries({ queryKey: ['event-proposal'] });
    },
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/event-proposals/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-proposals'] }),
  });
}

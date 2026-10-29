import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedEvents, CommunityEvent } from '@community/shared';

/** Which events a list asks for; the API defaults to events that have not ended. */
export interface EventListFilter {
  when?: 'upcoming' | 'past' | 'all';
  /** ISO dates: a period, e.g. the weeks shown in the calendar. */
  from?: string;
  to?: string;
  /** Only events the member said yes to. */
  mine?: boolean;
}

export function useEvents(page = 1, limit = 20, filter: EventListFilter = {}) {
  return useQuery({
    queryKey: ['events', page, limit, filter],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedEvents>('/events', {
        params: { page, limit, ...filter },
      });
      return data;
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const { data } = await apiClient.get<CommunityEvent>(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useRsvp(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) => {
      const { data } = await apiClient.post(`/events/${eventId}/rsvp`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCancelRsvp(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete(`/events/${eventId}/rsvp`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/** RSVP to every upcoming occurrence of a recurring event. */
export function useRsvpSeries(seriesId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) => {
      const { data } = await apiClient.post<{ count: number; skippedFull: number }>(
        `/events/series/${seriesId}/rsvp`,
        { status },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
    },
  });
}

/** Withdraws the RSVPs to every upcoming occurrence of a recurring event. */
export function useCancelSeriesRsvp(seriesId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<{ count: number }>(`/events/series/${seriesId}/rsvp`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
    },
  });
}

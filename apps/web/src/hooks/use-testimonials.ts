import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Testimonial {
  id: string;
  authorId: string;
  content: string;
  role: string | null;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  likeCount: number;
  commentCount: number;
}

export interface TestimonialComment {
  id: string;
  content: string;
  testimonialId: string;
  authorId: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

interface PaginatedTestimonials {
  data: Testimonial[];
  total: number;
  page: number;
  limit: number;
}

export function useTestimonials(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['testimonials', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedTestimonials>('/testimonials', {
        params: { page, limit },
      });
      return data;
    },
  });
}

export function useCreateTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { content: string; role?: string }) => {
      const { data } = await apiClient.post<Testimonial>('/testimonials', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });
}

/**
 * The public listing is readable without a token, so it cannot tell us which
 * testimonials the current member liked. Those IDs come from their own call.
 */
export function useMyTestimonialLikes() {
  return useQuery({
    queryKey: ['testimonials', 'my-likes'],
    queryFn: async () => {
      const { data } = await apiClient.get<string[]>('/testimonials/my-likes');
      return data;
    },
  });
}

export function useToggleTestimonialLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (testimonialId: string) => {
      const { data } = await apiClient.post<{ liked: boolean; likeCount: number }>(
        `/testimonials/${testimonialId}/like`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });
}

export function useTestimonialComments(testimonialId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['testimonials', testimonialId, 'comments'],
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<TestimonialComment[]>(
        `/testimonials/${testimonialId}/comments`,
      );
      return data;
    },
  });
}

export function useAddTestimonialComment(testimonialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data } = await apiClient.post<TestimonialComment>(
        `/testimonials/${testimonialId}/comments`,
        { content },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', testimonialId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });
}

export function useDeleteTestimonialComment(testimonialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      await apiClient.delete(`/testimonials/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', testimonialId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });
}

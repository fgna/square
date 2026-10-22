import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useBookmarks(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['bookmarks', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/posts/bookmarks', {
        params: { page, limit },
      });
      return data;
    },
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data } = await apiClient.post(`/posts/${postId}/bookmark`);
      return data as { bookmarked: boolean };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useIsBookmarked(postId: string) {
  return useQuery({
    queryKey: ['bookmark', postId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/posts/${postId}/bookmark`);
      return data as { bookmarked: boolean };
    },
    enabled: !!postId,
  });
}

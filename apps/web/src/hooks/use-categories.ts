import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/categories').then((r) => r.data),
  });
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: ['category', slug],
    queryFn: () => apiClient.get(`/categories/${slug}`).then((r) => r.data),
    enabled: !!slug,
  });
}

export function useCategoryContent(slug: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['category-content', slug, page, limit],
    queryFn: () =>
      apiClient
        .get(`/categories/${slug}/content`, { params: { page, limit } })
        .then((r) => r.data),
    enabled: !!slug,
  });
}

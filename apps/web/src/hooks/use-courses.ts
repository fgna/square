import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { PaginatedCourses, CourseWithProgress } from '@community/shared';

export function useCourses(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['courses', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCourses>('/courses', {
        params: { page, limit },
      });
      return data;
    },
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const { data } = await apiClient.get<CourseWithProgress>(`/courses/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useLessonNote(lessonId: string | null) {
  return useQuery({
    queryKey: ['lesson-note', lessonId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/courses/lessons/${lessonId}/notes`);
      return data;
    },
    enabled: !!lessonId,
  });
}

export function useUpsertNote(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data } = await apiClient.put(`/courses/lessons/${lessonId}/notes`, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-note', lessonId] });
    },
  });
}

export function useUpdateProgress(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (percentage: number) => {
      const { data } = await apiClient.put(`/courses/${courseId}/progress`, { percentage });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

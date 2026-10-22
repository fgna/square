import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useLocale } from 'next-intl';

export function useAssessmentQuestions() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['assessment-questions', locale],
    queryFn: () => apiClient.get('/assessments/questions', { params: { locale } }).then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useLatestAssessment() {
  return useQuery({
    queryKey: ['assessment-latest'],
    queryFn: () => apiClient.get('/assessments/latest').then((r) => r.data),
  });
}

export function useAssessmentHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['assessments', page, limit],
    queryFn: () =>
      apiClient.get('/assessments', { params: { page, limit } }).then((r) => r.data),
  });
}

export function useAssessmentRecommendations() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['assessment-recommendations', locale],
    queryFn: () => apiClient.get('/assessments/recommendations', { params: { locale } }).then((r) => r.data),
  });
}

export function useSubmitAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: { questionId: string; score: number | null }[]) =>
      apiClient.post('/assessments', { answers }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment-latest'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-recommendations'] });
    },
  });
}

/** Deletes all of the member's own assessments, so a new one starts unbiased. */
export function useDeleteAssessments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete('/assessments').then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment-latest'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-recommendations'] });
    },
  });
}

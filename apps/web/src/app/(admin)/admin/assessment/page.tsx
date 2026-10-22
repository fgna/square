'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { ClipboardCheck, Loader2 } from 'lucide-react';

interface Question {
  id: string;
  questionId: string;
  dimension: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
}

export default function AdminAssessmentPage() {
  const t = useTranslations('adminAssessmentUI');
  const mode = useQuery<{ readOnly: boolean }>({
    queryKey: ['admin', 'assessments', 'mode'],
    queryFn: () => apiClient.get('/assessments/admin/mode').then((response) => response.data),
    retry: false,
  });
  const questions = useQuery<Question[]>({
    queryKey: ['admin', 'assessments', 'questions'],
    queryFn: () => apiClient.get('/assessments/admin/questions').then((response) => response.data),
    enabled: mode.isSuccess,
    retry: false,
  });

  const grouped = Object.entries(
    (questions.data ?? []).reduce<Record<string, Question[]>>((acc, question) => {
      (acc[question.dimension] ??= []).push(question);
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} icon={ClipboardCheck} />
      {mode.isLoading || questions.isLoading ? (
        <div role="status" className="flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" size={18} />{t('loading')}
        </div>
      ) : mode.isError || questions.isError ? (
        <p role="alert" className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--theme-danger)' }}>
          {t('loadError')}
        </p>
      ) : (
        <>
          <section className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
            <h2 className="font-semibold">{mode.data?.readOnly ? t('managedTitle') : t('unsupportedTitle')}</h2>
            <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
              {mode.data?.readOnly ? t('managedDescription') : t('unsupportedDescription')}
            </p>
            <p className="text-sm">{t('questionCount', { count: questions.data?.length ?? 0 })}</p>
          </section>
          {grouped.map(([dimension, items]) => (
            <section key={dimension} className="rounded-xl border p-4" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
              <h2 className="font-semibold mb-3">{dimension}</h2>
              <ol className="space-y-3">
                {[...items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                  <li key={item.id} className="text-sm border-t pt-3" style={{ borderColor: 'var(--theme-border)' }}>
                    <span className="font-medium">{item.text}</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>{item.questionId}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {grouped.length === 0 && <p className="text-sm">{t('empty')}</p>}
        </>
      )}
    </div>
  );
}

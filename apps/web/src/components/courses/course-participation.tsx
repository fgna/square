'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useFormatters } from '@/lib/use-formatters';

interface Participation {
  course: { id: string; title: string; lessons: number };
  summary: { started: number; completed: number; activeLast30Days: number };
  members: {
    id: string;
    name: string;
    percentage: number;
    completedLessons: number;
    startedAt: string;
    lastActivityAt: string;
    completedAt: string | null;
  }[];
}

/** Admins see who takes part in a course: progress and last activity. */
export function CourseParticipation({ courseId }: { courseId: string }) {
  const t = useTranslations('adminCoursesUI.participation');
  const { formatDate } = useFormatters();
  const { data } = useQuery<Participation>({
    queryKey: ['admin', 'courses', courseId, 'participation'],
    queryFn: () => apiClient.get(`/admin/courses/${courseId}/participation`).then((r) => r.data),
  });
  if (!data) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
        <Users size={16} /> {t('title')}
      </h2>
      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        {t('summary', { started: data.summary.started, completed: data.summary.completed, active: data.summary.activeLast30Days })}
      </p>
      {data.members.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('none')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--theme-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--theme-text-muted)' }}>
                <th className="text-left px-3 py-2 font-medium">{t('member')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('progress')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('lessons')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('started')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('lastActivity')}</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}>
                  <td className="px-3 py-2">{m.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: 'var(--theme-border)' }}>
                        <div className="h-full" style={{ width: `${m.percentage}%`, background: 'var(--theme-primary)' }} />
                      </div>
                      <span className="tabular-nums text-xs">{m.percentage} %</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{m.completedLessons} / {data.course.lessons}</td>
                  <td className="px-3 py-2 text-xs">{formatDate(m.startedAt)}</td>
                  <td className="px-3 py-2 text-xs">{formatDate(m.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

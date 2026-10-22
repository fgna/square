'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, CheckCircle, Circle, ArrowLeft, BookOpen, Lock } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CourseProgress } from '@/components/courses/course-progress';
import { LessonNotes } from '@/components/courses/lesson-notes';
import { LessonView } from '@/components/courses/lesson-view';
import { nextOpenLesson } from '@/lib/next-lesson';

function useCourseDetail(id: string) {
  return useQuery({
    queryKey: ['courses', id],
    queryFn: () => apiClient.get(`/courses/${id}`).then((r) => r.data),
  });
}

function useCourseProgress(id: string) {
  return useQuery({
    queryKey: ['courses', id, 'progress'],
    queryFn: () => apiClient.get(`/courses/${id}/progress`).then((r) => r.data),
  });
}

export default function CourseDetailPage() {
  const t = useTranslations('courses');
  const { id } = useParams<{ id: string }>();
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: course, isLoading } = useCourseDetail(id);
  const { data: progress } = useCourseProgress(id);

  const lessonPanelRef = useRef<HTMLDivElement>(null);

  const updateProgress = useMutation({
    mutationFn: (lessonId: string) =>
      apiClient.post(`/courses/${id}/progress`, { lessonId }),
    onSuccess: (_data, lessonId) => {
      queryClient.invalidateQueries({ queryKey: ['courses', id, 'progress'] });

      // Carry on with the next lesson, unless drip still holds it back or
      // this was the last one — then the completed lesson stays in view.
      const next = nextOpenLesson(course?.modules ?? [], lessonId);
      if (!next) return;
      setOpenModules((prev) => new Set(prev).add(next.moduleId));
      setActiveLesson(next.lesson.id);
      lessonPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });

  const completedLessons: string[] = progress?.completedLessons ?? [];
  const percentage = progress?.percentage ?? 0;

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  const activeLessonData = course?.modules
    ?.flatMap((m: any) => m.lessons)
    ?.find((l: any) => l.id === activeLesson);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return <p style={{ color: 'var(--theme-text-muted)' }}>{t('notFound')}</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/courses" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        <ArrowLeft size={14} /> {t('back')}
      </Link>

      {course.coverUrl && (
        <img
          src={course.coverUrl}
          alt=""
          className="w-full rounded-xl object-cover"
          style={{ maxHeight: 220, border: '1px solid var(--theme-border)' }}
        />
      )}
      <PageHeader title={course.title} description={course.description} icon={BookOpen} />

      <CourseProgress percentage={percentage} completedLessons={completedLessons.length} totalLessons={
        course.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length ?? 0), 0) ?? 0
      } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module accordion */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--theme-text-muted)' }}>{t('content')}</h3>
          {(course.modules ?? []).map((module: any) => {
            const isOpen = openModules.has(module.id);
            const moduleLessons: any[] = module.lessons ?? [];
            const completedCount = moduleLessons.filter((l) => completedLessons.includes(l.id)).length;
            return (
              <div key={module.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left"
                  style={{ background: 'var(--theme-card)', color: 'var(--theme-text)' }}
                  onClick={() => toggleModule(module.id)}
                >
                  <span>{module.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {completedCount}/{moduleLessons.length}
                    </span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>
                {isOpen && (
                  <div style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {moduleLessons.map((lesson: any) => {
                      const done = completedLessons.includes(lesson.id);
                      const isActive = activeLesson === lesson.id;
                      return (
                        <button
                          key={lesson.id}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                          style={{
                            color: isActive ? 'var(--theme-primary)' : done ? 'var(--theme-text-muted)' : 'var(--theme-text)',
                            background: isActive ? 'rgba(197,168,128,0.08)' : 'transparent',
                          }}
                          onClick={() => setActiveLesson(lesson.id)}
                        >
                          {lesson.locked ? (
                            <Lock size={14} className="flex-shrink-0 opacity-60" />
                          ) : done ? (
                            <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                          ) : (
                            <Circle size={14} className="flex-shrink-0 opacity-40" />
                          )}
                          <span className="line-clamp-1">{lesson.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Lesson content */}
        <div className="lg:col-span-2 scroll-mt-24" ref={lessonPanelRef}>
          {activeLessonData ? (
            <div
              className="rounded-xl p-6 space-y-4"
              style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
            >
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--theme-text)' }}>
                  {activeLessonData.title}
                </h2>
                {completedLessons.includes(activeLessonData.id) ? (
                  <Badge className="bg-green-500/15 text-green-400 border-green-500/20">{t('completed')}</Badge>
                ) : null}
              </div>
              {/* Lesson text used to be printed as raw text, so markdown
                  showed its # and ** marks. */}
              <LessonView lesson={activeLessonData} />
              {!activeLessonData.locked && !completedLessons.includes(activeLessonData.id) && (
                <Button
                  onClick={() => updateProgress.mutate(activeLessonData.id)}
                  disabled={updateProgress.isPending}
                  style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
                >
                  <CheckCircle size={14} className="mr-2" />
                  {t('markComplete')}
                </Button>
              )}
              {/* Keyed so each lesson gets fresh notes state: otherwise the
                  previous lesson's text stayed in the box, and could be saved
                  onto the next lesson when that one had no note yet. */}
              {!activeLessonData.locked && <LessonNotes key={activeLessonData.id} lessonId={activeLessonData.id} />}
            </div>
          ) : (
            <div
              className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
              style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
            >
              <BookOpen size={40} className="mb-4 opacity-20" style={{ color: 'var(--theme-primary)' }} />
              <p className="font-medium mb-1" style={{ color: 'var(--theme-text)' }}>{t('selectTitle')}</p>
              <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                {t('selectText')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CourseCard } from '@/components/courses/course-card';
import { CourseSkeleton } from '@/components/common/loading-skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { useCourses } from '@/hooks/use-courses';

export default function CoursesPage() {
  const t = useTranslations('courses');
  const { data, isLoading } = useCourses(1, 50);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <CourseSkeleton key={i} />)}
        </div>
      ) : data?.data?.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('emptyTitle')} description={t('emptyText')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.data?.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ImageUploadField } from '@/components/common/image-upload-field';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Globe, Lock } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatDate } from '@community/shared';
import type { Course } from '@community/shared';

function useAdminCourses() {
  return useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => apiClient.get('/courses', { params: { limit: 100, all: true } }).then((r) => r.data),
  });
}

const TITLE_MIN = 3;
const DESCRIPTION_MIN = 10;

function CreateCourseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('adminCoursesUI');
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mirrors CreateCourseDto so the form fails before the request does, with a
  // message naming the field rather than a generic rejection.
  const validationError =
    title.trim().length < TITLE_MIN
      ? `Title needs at least ${TITLE_MIN} characters.`
      : description.trim().length < DESCRIPTION_MIN
        ? `Description needs at least ${DESCRIPTION_MIN} characters.`
        : null;

  const handleCreate = () => {
    setError(validationError);
    if (!validationError) create.mutate();
  };

  const create = useMutation({
    mutationFn: () => apiClient.post('/courses', { title, description, coverUrl: coverUrl || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
      setTitle(''); setDescription(''); setCoverUrl(null); setError(null);
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('new')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div
              role="alert"
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--theme-danger, #ef4444)',
              }}
            >
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="c-title">{t('title')}</Label>
            <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('sampleTitle')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">{t('description')}</Label>
            <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={t('sampleDesc')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('coverImage')}</Label>
            <ImageUploadField label={t('coverImage')} value={coverUrl} onChange={setCoverUrl} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={create.isPending}
            style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
          >
            {create.isPending ? t('creating') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCoursesPage() {
  const t = useTranslations('adminCoursesUI');
  // Started and completed members per course (Admin -> course -> participation for details).
  const { data: participation } = useQuery<Record<string, { started: number; completed: number }>>({
    queryKey: ['admin', 'courses', 'participation'],
    queryFn: () => apiClient.get('/admin/courses/participation').then((r) => r.data),
  });
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminCourses();
  const [createOpen, setCreateOpen] = useState(false);

  const togglePublish = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      apiClient.patch(`/courses/${id}`, { isPublished: published }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] }),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/courses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? t('deleteError')),
  });

  const courses: Course[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <CreateCourseDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <div className="flex items-start justify-between">
        <PageHeader title={t('management')} description={t('count', {count: data?.total ?? 0})} icon={BookOpen} />
        <Button
          size="sm"
          style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
          onClick={() => setCreateOpen(true)}
        >
          {t('new')}
        </Button>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--theme-border)' }}>
              {[t('course'), t('modules'), t('status'), t('created'), t('actions')].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              : courses.map((course) => (
                  <tr key={course.id} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium" style={{ color: 'var(--theme-text)' }}>{course.title}</p>
                        <p className="text-xs line-clamp-1" style={{ color: 'var(--theme-text-muted)' }}>{course.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {/* The list endpoint returns _count, not the modules themselves, so this always said 0. */}
                      {t('modulesCount', { count: course._count?.modules ?? course.modules?.length ?? 0 })}
                      {participation?.[course.id] && (
                        <span className="block">
                          {t('participationShort', { started: participation[course.id].started, completed: participation[course.id].completed })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={course.isPublished}
                          onCheckedChange={(checked) => togglePublish.mutate({ id: course.id, published: checked })}
                        />
                        <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                          {course.isPublished ? <><Globe size={10} className="inline mr-1" />{t('published')}</> : <><Lock size={10} className="inline mr-1" />{t('draft')}</>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {formatDate(course.createdAt)}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-1">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link href={`/admin/courses/${course.id}`}>{t('editContent')}</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-400 hover:text-red-300"
                        onClick={() => {
                          if (confirm(t('deleteConfirm', {name: course.title}))) {
                            deleteCourse.mutate(course.id);
                          }
                        }}
                      >
                        {t('delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

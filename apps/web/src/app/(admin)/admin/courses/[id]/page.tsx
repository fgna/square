'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Paperclip, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { LessonEditor } from '@/components/courses/lesson-editor';
import { ImageUploadField } from '@/components/common/image-upload-field';
import { CategoryPicker } from '@/components/common/category-picker';
import { useCourseEditor } from '@/hooks/use-course-editor';
import type { CourseReleaseMode, Lesson } from '@community/shared';
import { CourseParticipation } from '@/components/courses/course-participation';

const card = { background: 'var(--theme-card)', border: '1px solid var(--theme-border)' };

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30"
      style={{ color: danger ? 'var(--theme-danger)' : 'var(--theme-text-muted)' }}
    >
      {children}
    </button>
  );
}

/**
 * Builds a course: its settings, modules and lessons. Until this page, a
 * course could be created but never filled — modules and lessons existed
 * only in the seed script.
 */
export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const editor = useCourseEditor(id);
  const course = editor.course.data;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [releaseMode, setReleaseMode] = useState<CourseReleaseMode>('ALL_AT_ONCE');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const savedCategoryIds = (course?.categories ?? []).map((c) => c.category.id);
  const [newModule, setNewModule] = useState('');
  const [editing, setEditing] = useState<Lesson | null>(null);

  useEffect(() => {
    if (!course) return;
    setTitle(course.title);
    setDescription(course.description);
    setReleaseMode(course.releaseMode ?? 'ALL_AT_ONCE');
    setCategoryIds(savedCategoryIds);
    // Keyed on the saved values, so reloading after a module or lesson change
    // does not wipe settings that are being edited.
  }, [course?.id, course?.title, course?.description, course?.releaseMode, savedCategoryIds.join(',')]);

  if (editor.course.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!course) return <p style={{ color: 'var(--theme-text-muted)' }}>Course not found.</p>;

  const drip = course.releaseMode === 'DRIP';
  const settingsChanged =
    title !== course.title ||
    description !== course.description ||
    releaseMode !== (course.releaseMode ?? 'ALL_AT_ONCE') ||
    [...categoryIds].sort().join(',') !== [...savedCategoryIds].sort().join(',');

  const addLesson = (moduleId: string) => {
    const lessonTitle = window.prompt('Title of the new lesson');
    if (!lessonTitle?.trim()) return;
    editor.addLesson.mutate(
      { moduleId, title: lessonTitle.trim() },
      { onSuccess: (created) => setEditing(created as Lesson) },
    );
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        <ArrowLeft size={14} /> All courses
      </Link>

      <PageHeader
        title={course.title}
        description={course.isPublished ? 'Published — changes are visible to members right away' : 'Draft — only admins can see it'}
        icon={BookOpen}
      />

      {/* Settings */}
      <section className="rounded-xl p-5 space-y-4" style={card}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>Course settings</h2>
        <div className="space-y-1.5">
          <Label htmlFor="course-title">Title</Label>
          <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="course-description">Description</Label>
          <Textarea id="course-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cover image</Label>
          {/* Saved immediately: there is nothing else to confirm about a picture. */}
          <ImageUploadField
            label="Cover image"
            value={course.coverUrl}
            onChange={(coverUrl) => editor.updateCourse.mutate({ coverUrl })}
          />
        </div>
        <CategoryPicker value={categoryIds} onChange={setCategoryIds} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium mb-1" style={{ color: 'var(--theme-text)' }}>Release lessons</legend>
          {(
            [
              ['ALL_AT_ONCE', 'All at once', 'Members can open every lesson as soon as the course is published.'],
              ['DRIP', 'Step by step (drip)', 'Each lesson opens a set number of days after the member starts the course.'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: 'var(--theme-text)' }}>
              <input
                type="radio"
                name="releaseMode"
                className="mt-1"
                checked={releaseMode === value}
                onChange={() => setReleaseMode(value)}
              />
              <span>
                {label}
                <span className="block text-xs" style={{ color: 'var(--theme-text-muted)' }}>{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button
          size="sm"
          disabled={!settingsChanged || title.trim().length < 3 || description.trim().length < 10 || editor.updateCourse.isPending}
          onClick={() =>
            editor.updateCourse.mutate({ title: title.trim(), description: description.trim(), releaseMode, categoryIds })
          }
        >
          Save settings
        </Button>
      </section>

      {/* Modules and lessons */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>Modules and lessons</h2>

        {course.modules.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            No modules yet. A course is made of modules, and each module holds lessons — start with the first module below.
          </p>
        )}

        {course.modules.map((mod, mi) => (
          <div key={mod.id} className="rounded-xl" style={card}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
              <span className="flex-1 font-medium text-sm" style={{ color: 'var(--theme-text)' }}>
                {mi + 1}. {mod.title}
              </span>
              <IconButton label="Rename module" onClick={() => {
                const next = window.prompt('Module title', mod.title);
                if (next?.trim() && next.trim() !== mod.title) editor.renameModule.mutate({ id: mod.id, title: next.trim() });
              }}><Pencil size={14} /></IconButton>
              <IconButton label="Move module up" disabled={mi === 0} onClick={() => editor.moveModule.mutate({ id: mod.id, direction: 'up' })}>
                <ArrowUp size={14} />
              </IconButton>
              <IconButton label="Move module down" disabled={mi === course.modules.length - 1} onClick={() => editor.moveModule.mutate({ id: mod.id, direction: 'down' })}>
                <ArrowDown size={14} />
              </IconButton>
              <IconButton label="Delete module" danger onClick={() => {
                if (confirm(`Delete module "${mod.title}" and its ${mod.lessons.length} lesson(s)? This cannot be undone.`)) {
                  editor.deleteModule.mutate(mod.id);
                }
              }}><Trash2 size={14} /></IconButton>
            </div>

            <ul>
              {mod.lessons.map((lesson, li) => (
                <li key={lesson.id} className="flex items-center gap-2 px-4 py-2 text-sm" style={{ borderBottom: '1px solid var(--theme-border)' }}>
                  <button type="button" className="flex-1 text-left truncate hover:underline" style={{ color: 'var(--theme-text)' }} onClick={() => setEditing(lesson)}>
                    {lesson.title}
                  </button>
                  {lesson.videoUrl && <Video size={13} aria-label="Has video" style={{ color: 'var(--theme-text-muted)' }} />}
                  {(lesson.attachments?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      <Paperclip size={12} />{lesson.attachments!.length}
                    </span>
                  )}
                  {drip && (
                    <span className="text-xs px-1.5 rounded" style={{ color: 'var(--theme-primary)', background: 'rgba(197,168,128,0.1)' }}>
                      Day {lesson.releaseAfterDays ?? 0}
                    </span>
                  )}
                  <IconButton label="Edit lesson" onClick={() => setEditing(lesson)}><Pencil size={14} /></IconButton>
                  <IconButton label="Move lesson up" disabled={li === 0} onClick={() => editor.moveLesson.mutate({ id: lesson.id, direction: 'up' })}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label="Move lesson down" disabled={li === mod.lessons.length - 1} onClick={() => editor.moveLesson.mutate({ id: lesson.id, direction: 'down' })}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton label="Delete lesson" danger onClick={() => {
                    if (confirm(`Delete lesson "${lesson.title}"? This cannot be undone.`)) editor.deleteLesson.mutate(lesson.id);
                  }}><Trash2 size={14} /></IconButton>
                </li>
              ))}
            </ul>

            <div className="px-4 py-2">
              <Button size="sm" variant="ghost" onClick={() => addLesson(mod.id)} disabled={editor.addLesson.isPending}>
                <Plus size={14} className="mr-1" /> Add lesson
              </Button>
            </div>
          </div>
        ))}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newModule.trim()) return;
            editor.addModule.mutate(newModule.trim(), { onSuccess: () => setNewModule('') });
          }}
        >
          <Input placeholder="New module title" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
          <Button type="submit" size="sm" disabled={!newModule.trim() || editor.addModule.isPending}>
            <Plus size={14} className="mr-1" /> Add module
          </Button>
        </form>
      </section>

      <CourseParticipation courseId={id} />

      {editing && (
        <LessonEditor key={editing.id} courseId={id} lesson={editing} drip={drip} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

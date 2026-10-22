'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, StickyNote, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useLessonNote, useUpsertNote } from '@/hooks/use-courses';

interface LessonNotesProps {
  lessonId: string;
}

export function LessonNotes({ lessonId }: LessonNotesProps) {
  const t = useTranslations('courses');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const { data: note, isLoading } = useLessonNote(open ? lessonId : null);
  const upsert = useUpsertNote(lessonId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (note && !initializedRef.current) {
      setDraft(note.content || '');
      initializedRef.current = true;
    }
  }, [note]);

  useEffect(() => {
    initializedRef.current = false;
  }, [lessonId]);

  const save = useCallback(
    (content: string) => {
      upsert.mutate(content, {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      });
    },
    [upsert],
  );

  const handleChange = (value: string) => {
    setDraft(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 800);
  };

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (draft !== (note?.content || '')) {
      save(draft);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden mt-4"
      style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        {open ? (
          <ChevronDown size={14} style={{ color: 'var(--theme-primary)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
        )}
        <StickyNote size={14} style={{ color: 'var(--theme-primary)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
          {t('notes.title')}
        </span>
        {saved && (
          <span className="text-xs ml-auto" style={{ color: 'var(--theme-primary)' }}>
            {t('notes.saved')}
          </span>
        )}
        {upsert.isPending && (
          <Loader2 size={12} className="ml-auto animate-spin" style={{ color: 'var(--theme-text-muted)' }} />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--theme-border)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
            </div>
          ) : (
            <Textarea
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              placeholder={t('notes.placeholder')}
              rows={5}
              className="mt-3"
            />
          )}
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--theme-text-muted)', opacity: 0.6 }}>
            {t('notes.hint')}
          </p>
        </div>
      )}
    </div>
  );
}

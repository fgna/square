'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Pencil, Send, Trash2 } from 'lucide-react';
import type { Post } from '@community/shared';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renderPostContent } from '@/lib/render-post-content';
import { EditPost } from './edit-post';

type ScheduledPost = Post & { publishAt: string };

/** "2026-11-02T05:00:00Z" → the value a datetime-local input shows in this browser's time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Admins see their scheduled posts above the feed: when each one goes out,
 * and they can edit, move, publish at once or delete it until then.
 */
export function ScheduledPosts() {
  const t = useTranslations('feed');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: posts } = useQuery<ScheduledPost[]>({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => apiClient.get('/posts/scheduled').then((r) => r.data),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; value: string } | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };
  const reschedule = useMutation({
    mutationFn: ({ id, publishAt }: { id: string; publishAt: string | null }) =>
      apiClient.patch(`/posts/${id}/schedule`, { publishAt }),
    onSuccess: () => { setMoving(null); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/posts/${id}`),
    onSuccess: refresh,
  });

  if (!posts?.length) return null;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--theme-card)', border: '1px dashed var(--theme-border)' }}>
      <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
        <Clock size={14} /> {t('schedule.heading')}
      </h2>
      {posts.map((post) => (
        <article key={post.id} className="rounded-lg p-3 space-y-2" style={{ border: '1px solid var(--theme-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>
            {t('schedule.for', { date: when(post.publishAt) })}
          </p>
          {editing === post.id ? (
            <EditPost post={post} onDone={() => { setEditing(null); refresh(); }} />
          ) : (
            <div
              className={`text-sm leading-relaxed line-clamp-4 ${renderPostContent(post.content).className}`}
              style={{ color: 'var(--theme-text)' }}
              dangerouslySetInnerHTML={{ __html: renderPostContent(post.content).html }}
            />
          )}
          {moving?.id === post.id && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="datetime-local"
                value={moving.value}
                onChange={(e) => setMoving({ id: post.id, value: e.target.value })}
                className="h-8 w-auto text-xs"
                aria-label={t('schedule.move')}
              />
              <Button
                size="sm"
                disabled={!moving.value || reschedule.isPending}
                onClick={() => reschedule.mutate({ id: post.id, publishAt: new Date(moving.value).toISOString() })}
              >
                {t('schedule.moveSave')}
              </Button>
            </div>
          )}
          {editing !== post.id && (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(post.id)}>
                <Pencil size={13} className="mr-1" />{t('edit.label')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMoving({ id: post.id, value: toLocalInput(post.publishAt) })}>
                <Clock size={13} className="mr-1" />{t('schedule.move')}
              </Button>
              <Button size="sm" variant="ghost" disabled={reschedule.isPending} onClick={() => reschedule.mutate({ id: post.id, publishAt: null })}>
                <Send size={13} className="mr-1" />{t('schedule.publishNow')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400"
                disabled={remove.isPending}
                onClick={() => { if (confirm(t('schedule.deleteConfirm'))) remove.mutate(post.id); }}
              >
                <Trash2 size={13} className="mr-1" />{t('schedule.delete')}
              </Button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

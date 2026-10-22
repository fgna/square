'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, EyeOff, Eye, Check, MessageSquareWarning } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/store/toast.store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, timeAgo } from '@community/shared';
import type { Post } from '@community/shared';
import { previewText } from '@/lib/preview-text';

type Queue = 'reported' | 'visible' | 'hidden';

interface ModerationPost extends Post {
  reports?: { id: string; reason: string; createdAt: string; reporter: { id: string; name: string } }[];
  _count?: Post['_count'] & { reports?: number };
}

const QUEUES: { value: Queue; label: 'queueReported' | 'queueAll' | 'queueHidden'; empty: 'emptyReported' | 'emptyAll' | 'emptyHidden' }[] = [
  { value: 'reported', label: 'queueReported', empty: 'emptyReported' },
  { value: 'visible', label: 'queueAll', empty: 'emptyAll' },
  { value: 'hidden', label: 'queueHidden', empty: 'emptyHidden' },
];

function useModerationQueue(queue: Queue) {
  return useQuery({
    queryKey: ['admin', 'posts', queue],
    queryFn: () =>
      apiClient.get('/admin/moderation', { params: { status: queue, limit: 50 } }).then((r) => r.data),
  });
}

/**
 * Hides a post and tells its author why, privately, as a direct message —
 * so they can fix it and ask for it to be shown again, instead of it simply
 * disappearing.
 */
function FeedbackDialog({ post, onClose, onDone }: { post: ModerationPost; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('adminModerationUI');
  const [feedback, setFeedback] = useState('');
  const author = post.author?.name ?? t('theAuthor');
  const send = useMutation({
    mutationFn: () => apiClient.post(`/admin/posts/${post.id}/hide-with-feedback`, { feedback: feedback.trim() }),
    onSuccess: () => {
      toast.success(t('hiddenToast'), t('hiddenToastDesc', { name: author }));
      onDone();
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('messageTitle', { name: author })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm line-clamp-3" style={{ color: 'var(--theme-text-muted)' }}>
          “{previewText(post.content)}”
        </p>
        <Textarea
          aria-label={t('feedbackLabel')}
          rows={5}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={t('feedbackPlaceholder')}
        />
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {t('feedbackHint')}
        </p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button size="sm" disabled={feedback.trim().length < 3 || send.isPending} onClick={() => send.mutate()}>
            {t('hideAndSend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ModerationPage() {
  const t = useTranslations('adminModerationUI');
  const [messaging, setMessaging] = useState<ModerationPost | null>(null);
  const queryClient = useQueryClient();
  const reported = useModerationQueue('reported');
  // Open on the reports when there are any; otherwise on all posts. Opening on
  // an empty "Reported" list made it look as if posts never reached moderation.
  const [chosen, setChosen] = useState<Queue | null>(null);
  const queue: Queue = chosen ?? ((reported.data?.total ?? 0) > 0 ? 'reported' : 'visible');
  const setQueue = setChosen;
  const { data, isLoading } = useModerationQueue(queue);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });

  const toggleHide = useMutation({
    // The API toggles visibility; it takes no body. Hiding also closes open reports.
    mutationFn: (id: string) => apiClient.patch(`/admin/posts/${id}/hide`),
    onSuccess: refresh,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/admin/posts/${id}/dismiss-reports`),
    onSuccess: refresh,
  });

  const posts: ModerationPost[] = data?.data ?? [];
  const openReports = reported.data?.total ?? 0;
  const current = QUEUES.find((q) => q.value === queue)!;

  return (
    <div className="space-y-6">
      {messaging && <FeedbackDialog post={messaging} onClose={() => setMessaging(null)} onDone={refresh} />}

      <PageHeader title={t('title')} description={t('description')} icon={Flag} />

      <div className="flex items-center gap-2" role="tablist">
        {QUEUES.map(({ value, label }) => (
          <Button
            key={value}
            role="tab"
            aria-selected={queue === value}
            size="sm"
            variant={queue === value ? 'default' : 'outline'}
            onClick={() => setQueue(value)}
            style={queue === value ? { background: 'var(--theme-primary)', color: 'var(--theme-background)' } : {}}
          >
            {t(label)}
            {value === 'reported' && openReports > 0 && (
              <span className="ml-1.5 rounded-full px-1.5 text-xs bg-red-500 text-white">{openReports}</span>
            )}
          </Button>
        ))}
        <span className="text-sm ml-2" style={{ color: 'var(--theme-text-muted)' }}>
          {t('total', { count: data?.total ?? 0 })}
        </span>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
            <Flag size={32} className="mx-auto mb-3 opacity-30" />
            <p>{t(current.empty)}</p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl p-4 flex items-start gap-4"
              style={{
                background: post.isHidden ? 'rgba(239,68,68,0.05)' : 'var(--theme-card)',
                border: `1px solid ${post.isHidden ? 'rgba(239,68,68,0.2)' : 'var(--theme-border)'}`,
              }}
            >
              <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                <AvatarFallback style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)', fontSize: '11px' }}>
                  {getInitials(post.author?.name ?? 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                    {post.author?.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {timeAgo(post.createdAt)}
                  </span>
                  {post.isHidden && (
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-xs">{t('hidden')}</Badge>
                  )}
                  {(post._count?.reports ?? 0) > 0 && (
                    <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/20 text-xs">
                      {t('reportCount', { count: post._count?.reports ?? 0 })}
                    </Badge>
                  )}
                </div>
                <p className="text-sm line-clamp-2" style={{ color: post.isHidden ? 'var(--theme-text-muted)' : 'var(--theme-text)' }}>
                  {previewText(post.content)}
                </p>
                {post.reports && post.reports.length > 0 && (
                  <ul className="space-y-1 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {post.reports.map((r) => (
                      <li key={r.id}>
                        <span style={{ color: 'var(--theme-text)' }}>{r.reporter.name}</span>: {r.reason}
                        <span className="opacity-70"> · {timeAgo(r.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => toggleHide.mutate(post.id)}>
                  {post.isHidden ? <Eye size={14} className="mr-1" /> : <EyeOff size={14} className="mr-1" />}
                  {post.isHidden ? t('unhide') : t('hidePost')}
                </Button>
                {!post.isHidden && (
                  <Button size="sm" variant="ghost" onClick={() => setMessaging(post)} title={t('hideMessageTitle')}>
                    <MessageSquareWarning size={14} className="mr-1" /> {t('hideMessage')}
                  </Button>
                )}
                {queue === 'reported' && (
                  <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(post.id)} title={t('keepTitle')}>
                    <Check size={14} className="mr-1" /> {t('keep')}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

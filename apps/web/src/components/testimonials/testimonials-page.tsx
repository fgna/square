'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useTestimonials,
  useCreateTestimonial,
  useMyTestimonialLikes,
  useToggleTestimonialLike,
  useTestimonialComments,
  useAddTestimonialComment,
  useDeleteTestimonialComment,
} from '@/hooks/use-testimonials';
import type { Testimonial } from '@/hooks/use-testimonials';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@community/shared';
import { useFormatters } from '@/lib/use-formatters';
import { Star, Quote, Loader2, Send, Heart, MessageCircle, Trash2 } from 'lucide-react';

function CommentSection({ testimonialId }: { testimonialId: string }) {
  const t = useTranslations('testimonials');
  const { timeAgo } = useFormatters();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const { data: comments, isLoading } = useTestimonialComments(testimonialId, true);
  const addComment = useAddTestimonialComment(testimonialId);
  const deleteComment = useDeleteTestimonialComment(testimonialId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await addComment.mutateAsync(draft.trim());
    setDraft('');
  };

  return (
    <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
      {isLoading ? (
        <Skeleton className="h-4 w-32" />
      ) : comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => {
            const canDelete = user?.id === comment.authorId || user?.role === 'ADMIN';
            return (
              <div key={comment.id} className="flex items-start gap-2.5">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={comment.author.avatarUrl || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(comment.author.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--theme-text)' }}>
                      {comment.author.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  <p
                    className="text-sm whitespace-pre-wrap"
                    style={{ color: 'var(--theme-text)' }}
                  >
                    {comment.content}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    aria-label={t('deleteComment')}
                    onClick={() => deleteComment.mutate(comment.id)}
                    className="flex-shrink-0 p-1 rounded transition-colors"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {t('noComments')}
        </p>
      )}

      {user && (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('commentPlaceholder')}
            maxLength={2000}
            className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />
          <Button type="submit" size="sm" disabled={!draft.trim() || addComment.isPending}>
            {addComment.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </form>
      )}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  likedByMe,
}: {
  testimonial: Testimonial;
  likedByMe: boolean;
}) {
  const t = useTranslations('testimonials');
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const toggleLike = useToggleTestimonialLike();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <Quote size={24} style={{ color: 'var(--theme-primary)', opacity: 0.4 }} />
          {testimonial.isFeatured && (
            <Badge>
              <Star size={10} className="mr-1" />
              {t('featured')}
            </Badge>
          )}
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text)' }}>
          {testimonial.content}
        </p>

        <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--theme-border)' }}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={testimonial.author.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(testimonial.author.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
              {testimonial.author.name}
            </p>
            {testimonial.role && (
              <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                {testimonial.role}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!user || toggleLike.isPending}
            aria-pressed={likedByMe}
            onClick={() => toggleLike.mutate(testimonial.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{ color: likedByMe ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
          >
            <Heart size={14} fill={likedByMe ? 'currentColor' : 'none'} />
            {testimonial.likeCount > 0 && testimonial.likeCount}
            <span className="sr-only">{t('like')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            aria-expanded={showComments}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ color: showComments ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
          >
            <MessageCircle size={14} />
            {testimonial.commentCount > 0 && testimonial.commentCount}
            <span className="sr-only">{t('comments')}</span>
          </button>
        </div>

        {showComments && <CommentSection testimonialId={testimonial.id} />}
      </CardContent>
    </Card>
  );
}

function SubmitForm() {
  const t = useTranslations('testimonials');
  const [content, setContent] = useState('');
  const [role, setRole] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const createTestimonial = useCreateTestimonial();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    await createTestimonial.mutateAsync({
      content: content.trim(),
      role: role.trim() || undefined,
    });

    setContent('');
    setRole('');
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <Star size={32} className="mx-auto" style={{ color: 'var(--theme-primary)' }} />
          <p className="font-medium" style={{ color: 'var(--theme-text)' }}>
            {t('thanksTitle')}
          </p>
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {t('thanksText')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubmitted(false)}
            className="mt-2"
          >
            {t('submitAnother')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>
          {t('formTitle')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('contentPlaceholder')}
            rows={4}
            className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t('rolePlaceholder')}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {t('approvalNote')}
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={!content.trim() || createTestimonial.isPending}
            >
              {createTestimonial.isPending ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <Send size={14} className="mr-1" />
              )}
              {t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function TestimonialsPage() {
  const t = useTranslations('testimonials');
  const { data, isLoading, error, refetch } = useTestimonials();
  const { data: myLikes } = useMyTestimonialLikes();
  const likedIds = new Set(myLikes ?? []);
  const { user } = useAuth();

  const testimonials: Testimonial[] = data?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        {/* Named apart from the forum's success stories, which are posts. */}
        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>
          {t('title')}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      {user && <SubmitForm />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-5 w-5" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p style={{ color: 'var(--theme-danger)' }}>{t('loadError')}</p>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {(error as { message?: string })?.message || t('unknownError')}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('retry')}
            </Button>
          </CardContent>
        </Card>
      ) : !testimonials.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Star size={40} className="mx-auto mb-3" style={{ color: 'var(--theme-text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--theme-text)' }}>
              {t('emptyTitle')}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              {t('emptyText')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
              likedByMe={likedIds.has(testimonial.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

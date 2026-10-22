'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCreateComment } from '@/hooks/use-feed';
import { getInitials } from '@community/shared';
import { useFormatters } from '@/lib/use-formatters';
import type { Post } from '@community/shared';

interface CommentListProps {
  post: Post;
}

export function CommentList({ post }: CommentListProps) {
  const t = useTranslations('feed');
  const { timeAgo } = useFormatters();
  const [comment, setComment] = useState('');
  const createComment = useCreateComment(post.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await createComment.mutateAsync(comment.trim());
    setComment('');
  };

  return (
    <div className="space-y-3 pt-2">
      {(post.comments || []).map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarImage src={c.author.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">{getInitials(c.author.name)}</AvatarFallback>
          </Avatar>
          <div
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--theme-border)' }}
          >
            <span className="font-medium mr-2" style={{ color: 'var(--theme-text)' }}>
              {c.author.name}
            </span>
            <span style={{ color: 'var(--theme-text)' }}>{c.content}</span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              {timeAgo(c.createdAt)}
            </p>
          </div>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('comments.placeholder')}
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!comment.trim() || createComment.isPending}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: comment.trim() ? 'var(--theme-primary)' : 'rgba(255,255,255,0.06)',
            color: comment.trim() ? 'var(--theme-background)' : 'var(--theme-text-muted)',
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

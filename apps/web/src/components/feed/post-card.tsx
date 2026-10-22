'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, MoreHorizontal, Trash2, Pencil, Flag, Pin, HelpCircle, Megaphone, Hand, Trophy, Bookmark, BookmarkCheck, Lightbulb } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ReactionBar } from './reaction-bar';
import { CommentList } from './comment-list';
import { PollCard } from './poll-card';
import { EditPost } from './edit-post';
import { ReportPostDialog } from './report-post-dialog';
import { useDeletePost } from '@/hooks/use-feed';
import { useToggleBookmark, useIsBookmarked } from '@/hooks/use-bookmarks';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@community/shared';
import { useFormatters } from '@/lib/use-formatters';
import type { Post } from '@community/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { renderMarkdown } from '@/lib/markdown';
import { renderPostContent } from '@/lib/render-post-content';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const t = useTranslations('feed');
  const { user } = useAuth();
  const { timeAgo } = useFormatters();
  const [showComments, setShowComments] = useState(false);
  const deletePost = useDeletePost();
  const toggleBookmark = useToggleBookmark();
  const { data: bookmarkStatus } = useIsBookmarked(post.id);
  const isBookmarked = bookmarkStatus?.bookmarked ?? false;

  // The API lets the author and admins both edit and delete (posts.service.ts).
  const canDelete = user?.id === post.authorId || user?.role === 'ADMIN';
  const canEdit = canDelete;
  // Anyone signed in may report someone else's post.
  const canReport = !!user && user.id !== post.authorId;
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);

  const handleDelete = async () => {
    if (confirm(t('card.confirmDelete'))) {
      try {
        await deletePost.mutateAsync(post.id);
      } catch {
        alert(t('card.deleteFailed'));
      }
    }
  };

  return (
    <article
      className="rounded-xl p-5 space-y-4 animate-fade-in"
      style={{
        background: 'var(--theme-card)',
        backdropFilter: 'blur(var(--theme-blur))',
        border: post.isPinned ? '1px solid rgba(197,168,128,0.3)' : '1px solid var(--theme-border)',
        boxShadow: post.isPinned ? '0 0 20px rgba(197,168,128,0.08)' : 'none',
      }}
    >
      {(post.isPinned || ((post as any).type && (post as any).type !== 'DISCUSSION')) && (
        <div className="flex items-center gap-3">
          {post.isPinned && (
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>
              <Pin size={12} />
              {t('pinned')}
            </div>
          )}
          {(post as any).type === 'QUESTION' && (
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#3b82f6' }}>
              <HelpCircle size={12} /> {t('types.QUESTION')}
            </div>
          )}
          {(post as any).type === 'ANNOUNCEMENT' && (
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#f59e0b' }}>
              <Megaphone size={12} /> {t('types.ANNOUNCEMENT')}
            </div>
          )}
          {(post as any).type === 'INTRODUCTION' && (
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#22c55e' }}>
              <Hand size={12} /> {t('types.INTRODUCTION')}
            </div>
          )}
          {(post as any).type === 'SUCCESS_STORY' && (
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#a855f7' }}>
              <Trophy size={12} /> {t('types.SUCCESS_STORY')}
            </div>
          )}
          {(post as any).type === 'TOPIC_SUGGESTION' && (
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#06b6d4' }}>
              <Lightbulb size={12} /> {t('types.TOPIC_SUGGESTION')}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={post.author.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">{getInitials(post.author.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                {post.author.name}
              </p>
              {post.author.role === 'ADMIN' && (
                <Badge className="text-xs py-0 px-1.5">Admin</Badge>
              )}
            </div>
            <Link href={`/feed/${post.id}`} className="text-xs hover:underline" style={{ color: 'var(--theme-text-muted)' }}>
              {timeAgo(post.createdAt)}
            </Link>
          </div>
        </div>

        {(canDelete || canReport) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-md hover:bg-white/5 flex-shrink-0">
                <MoreHorizontal size={16} style={{ color: 'var(--theme-text-muted)' }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => setEditing(true)} className="gap-2 cursor-pointer">
                  <Pencil size={14} />
                  <span>{t('card.edit')}</span>
                </DropdownMenuItem>
              )}
              {canReport && (
                <DropdownMenuItem onClick={() => setReporting(true)} className="gap-2 cursor-pointer">
                  <Flag size={14} />
                  <span>{t('card.report')}</span>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={handleDelete} className="gap-2 cursor-pointer">
                  <Trash2 size={14} style={{ color: 'var(--theme-danger)' }} />
                  <span style={{ color: 'var(--theme-danger)' }}>{t('card.delete')}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {reporting && <ReportPostDialog postId={post.id} onClose={() => setReporting(false)} />}

      {editing ? (
        <EditPost post={post} onDone={() => setEditing(false)} />
      ) : (
      <Link href={`/feed/${post.id}`} className="block">
        <div
          className={`text-sm leading-relaxed cursor-pointer ${renderPostContent(post.content).className}`}
          style={{ color: 'var(--theme-text)' }}
          dangerouslySetInnerHTML={{ __html: renderPostContent(post.content).html }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('md-hashtag')) {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('feed:hashtag', { detail: target.textContent?.toLowerCase() }));
            }
          }}
        />
      </Link>
      )}

      {post.poll && (
        <PollCard poll={post.poll} postId={post.id} />
      )}

      {(post as any).categories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(post as any).categories.map((pc: any) => (
            <span
              key={pc.category.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                background: (pc.category.color || '#6b7280') + '18',
                color: pc.category.color || 'var(--theme-text-muted)',
              }}
            >
              {pc.category.icon && <span>{pc.category.icon}</span>}
              {pc.category.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 pt-1" style={{ borderTop: '1px solid var(--theme-border)' }}>
        <ReactionBar post={post} />
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <MessageCircle size={14} />
          <span>{post._count?.comments ?? post.comments?.length ?? 0}</span>
        </button>
        <button
          onClick={() => toggleBookmark.mutate(post.id)}
          className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-lg transition-colors hover:bg-white/5 ml-auto"
          style={{ color: isBookmarked ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
          title={isBookmarked ? t('card.unbookmark') : t('card.bookmark')}
        >
          {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </button>
      </div>

      {showComments && (
        <CommentList post={post} />
      )}
    </article>
  );
}

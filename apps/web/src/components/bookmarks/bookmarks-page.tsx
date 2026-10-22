'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bookmark as BookmarkIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PostCard } from '@/components/feed/post-card';
import { useBookmarks } from '@/hooks/use-bookmarks';

export function BookmarksPage() {
  const t = useTranslations('bookmarks');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBookmarks(page);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={BookmarkIcon}
      />

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-5 animate-pulse"
              style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full" style={{ background: 'var(--theme-border)' }} />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 rounded" style={{ background: 'var(--theme-border)' }} />
                  <div className="h-2 w-16 rounded" style={{ background: 'var(--theme-border)' }} />
                </div>
              </div>
              <div className="h-4 w-full rounded mb-2" style={{ background: 'var(--theme-border)' }} />
              <div className="h-4 w-2/3 rounded" style={{ background: 'var(--theme-border)' }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && data?.data?.length === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
        >
          <BookmarkIcon
            size={40}
            className="mx-auto mb-3"
            style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
            {t('emptyTitle')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            {t('emptyText')}
          </p>
        </div>
      )}

      {!isLoading && data?.data && (
        <div className="space-y-4">
          {data.data.map((bookmark: any) => (
            <PostCard key={bookmark.id} post={bookmark.post} />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{
              background: 'var(--theme-card)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
            }}
          >
            {t('previous')}
          </button>
          <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {t('pageOf', { page, total: data.totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{
              background: 'var(--theme-card)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
            }}
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  );
}

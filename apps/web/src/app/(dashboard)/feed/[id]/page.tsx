'use client';

import { useTranslations } from 'next-intl';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { PostCard } from '@/components/feed/post-card';
import { PostSkeleton } from '@/components/common/loading-skeleton';

export default function PostPage() {
  const t = useTranslations('postDetailUI');
  const { id } = useParams<{ id: string }>();
  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => apiClient.get(`/posts/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/feed" className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        <ArrowLeft size={14} /> {t('back')}
      </Link>
      {isLoading ? <PostSkeleton /> : post ? <PostCard post={post} /> : (
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('missing')}</p>
      )}
    </div>
  );
}

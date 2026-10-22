'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check, Undo2, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials, timeAgo } from '@community/shared';

type Status = 'pending' | 'approved' | 'all';

interface AdminTestimonial {
  id: string;
  content: string;
  role: string | null;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; email: string };
}

const TABS: { value: Status; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All' },
];

function useAdminTestimonials(status: Status) {
  return useQuery({
    queryKey: ['admin', 'testimonials', status],
    queryFn: () =>
      apiClient
        .get('/testimonials/admin', { params: { status, limit: 50 } })
        .then((r) => r.data),
  });
}

export default function AdminTestimonialsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminTestimonials(status);

  // Both the admin list and the public list change whenever approval changes.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'testimonials'] });
    queryClient.invalidateQueries({ queryKey: ['testimonials'] });
  };

  const setApproval = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      apiClient.patch(`/testimonials/${id}/${approved ? 'approve' : 'unapprove'}`),
    onSuccess: refresh,
  });

  const toggleFeatured = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/testimonials/${id}/feature`),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/testimonials/${id}`),
    onSuccess: refresh,
  });

  const testimonials: AdminTestimonial[] = data?.data ?? [];
  const pendingCount: number = data?.pendingCount ?? 0;
  const busy = setApproval.isPending || toggleFeatured.isPending || remove.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testimonials"
        description="Review member submissions before they appear publicly"
        icon={Star}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const isActive = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: isActive ? 'rgba(197,168,128,0.15)' : 'transparent',
                  color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                  border: `1px solid ${isActive ? 'rgba(197,168,128,0.25)' : 'var(--theme-border)'}`,
                }}
              >
                {tab.label}
                {tab.value === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
              </button>
            );
          })}
        </div>
        <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {data?.total ?? 0} shown
        </span>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4"
              style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
            >
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))
        ) : testimonials.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
            <Star size={32} className="mx-auto mb-3 opacity-30" />
            <p>
              {status === 'pending'
                ? 'Nothing waiting for review'
                : 'No testimonials here yet'}
            </p>
          </div>
        ) : (
          testimonials.map((item) => (
            <div
              key={item.id}
              className="rounded-xl p-4 flex items-start gap-4"
              style={{
                background: item.isApproved ? 'var(--theme-card)' : 'rgba(234,179,8,0.05)',
                border: `1px solid ${item.isApproved ? 'var(--theme-border)' : 'rgba(234,179,8,0.2)'}`,
              }}
            >
              <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                <AvatarImage src={item.author?.avatarUrl || undefined} />
                <AvatarFallback
                  style={{
                    background: 'var(--theme-primary)',
                    color: 'var(--theme-background)',
                    fontSize: '11px',
                  }}
                >
                  {getInitials(item.author?.name ?? 'U')}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                    {item.author?.name}
                  </span>
                  {item.role && (
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {item.role}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {timeAgo(item.createdAt)}
                  </span>
                  {item.isApproved ? (
                    <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-xs">
                      Approved
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/20 text-xs">
                      Pending
                    </Badge>
                  )}
                  {item.isFeatured && (
                    <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/20 text-xs">
                      Featured
                    </Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--theme-text)' }}>
                  {item.content}
                </p>
              </div>

              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {item.isApproved ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setApproval.mutate({ id: item.id, approved: false })}
                  >
                    <Undo2 size={14} className="mr-1" />
                    Revoke
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => setApproval.mutate({ id: item.id, approved: true })}
                    style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}
                  >
                    <Check size={14} className="mr-1" />
                    Approve
                  </Button>
                )}

                {item.isApproved && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => toggleFeatured.mutate(item.id)}
                  >
                    <Star
                      size={14}
                      className="mr-1"
                      fill={item.isFeatured ? 'currentColor' : 'none'}
                    />
                    {item.isFeatured ? 'Unfeature' : 'Feature'}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Delete this testimonial permanently?')) {
                      remove.mutate(item.id);
                    }
                  }}
                  style={{ color: 'var(--theme-danger, #ef4444)' }}
                >
                  <Trash2 size={14} className="mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
